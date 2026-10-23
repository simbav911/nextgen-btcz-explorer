const logger = require('../utils/logger');
const bitcoinzService = require('./bitcoinzService'); // Use full service for fallbacks
const cache = require('../utils/cache');

// Only the primary instance (the one that runs the indexer) performs the
// opportunistic background writes below; extra/read-only instances
// (NODE_APP_INSTANCE != 0) never write to the DB.
const CAN_WRITE_DB = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0';

const ADDRESS_INFO_TTL_MS = 10000;
const ADDRESS_SAVE_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000; // refresh a stored txid list at most every 6h
const MAX_PAGE_SIZE = 100;
const TX_FETCH_CONCURRENCY = 4;

// bitcoinzd has no getaddressinfo; remember that instead of calling (and
// logging an RPC error) on every address page view.
let getAddressInfoRpcSupported = true;

const addressSaveTimes = cache.createBoundedMap(10000);

/**
 * Get address details (balance, totals, tx count) via RPC.
 *
 * Note: this used to "try the DB first", but that code referenced an undefined
 * `models` variable, so it always threw and fell through to RPC. The RPC path
 * is therefore what clients have always received; the dead DB attempt is
 * removed (DB balances also differ from the node's for bulk-synced history).
 */
const getAddressInfo = async (address) => {
  // /addresses/:address and /addresses/:address/balance are requested together
  return cache.wrap(`addrinfo:${address}`, ADDRESS_INFO_TTL_MS, () => loadAddressInfo(address));
};

const loadAddressInfo = async (address) => {
  try {
    logger.info(`Fetching address info via RPC for ${address}`);
    let balance = 0;
    let totalReceived = 0;
    let totalSent = 0;
    let unconfirmedBalance = 0; // RPC might provide this, but often requires specific calls
    let txCount = 0;

    // Balance and tx list are independent: fetch them concurrently
    const txidsPromise = bitcoinzService.getAddressTxids(address, 60000)
      .then(txids => ({ txids }))
      .catch(error => ({ error }));

    // Try getaddressbalance first (more accurate if node has balanceindex)
    try {
      const balanceResult = await bitcoinzService.executeRpcCommand('getaddressbalance', [{"addresses": [address]}], 60000);
      if (balanceResult && typeof balanceResult.balance !== 'undefined' && typeof balanceResult.received !== 'undefined') {
        balance = parseFloat(balanceResult.balance) / 100000000;
        totalReceived = parseFloat(balanceResult.received) / 100000000;
        totalSent = totalReceived - balance; // Calculate sent
        logger.info(`Got balance from getaddressbalance RPC for ${address}`);
      } else {
         logger.warn(`Invalid getaddressbalance RPC response for ${address}, trying listunspent`);
         throw new Error('Invalid getaddressbalance response'); // Force fallback
      }
    } catch (balanceError) {
      logger.warn(`getaddressbalance RPC failed for ${address}: ${balanceError.message}. Trying listunspent.`);
      // Fallback to listunspent (less accurate for total received/sent)
      try {
        const utxos = await bitcoinzService.executeRpcCommand('listunspent', [0, 9999999, [address]], 60000);
        balance = utxos.reduce((sum, utxo) => sum + utxo.amount, 0);
        // Cannot accurately get totalReceived/Sent from listunspent alone
        totalReceived = balance; // Best guess/approximation
        totalSent = 0;
        logger.info(`Calculated balance from listunspent RPC for ${address}`);
      } catch (utxoError) {
        logger.error(`Error fetching UTXOs via RPC for ${address}: ${utxoError.message}`);
        // If both balance methods fail, we might return 0 or throw
      }
    }

    // Get transaction count using getaddresstxids (requires addressindex or import)
    const txidsResult = await txidsPromise;
    if (txidsResult.error) {
      logger.warn(`Error getting txids via RPC for ${address}: ${txidsResult.error.message}`);
    } else {
      txCount = txidsResult.txids ? txidsResult.txids.length : 0;
      logger.info(`Found ${txCount} transactions via getaddresstxids RPC for ${address}`);
    }

    return {
      address,
      balance,
      totalReceived,
      totalSent,
      unconfirmedBalance,
      txCount
    };

  } catch (error) {
    logger.error(`Failed to get address info for ${address} via RPC fallback:`, error.message);
    // Re-throw the error if RPC fallback also fails completely
    throw new Error(`Failed to retrieve address info for ${address} from both DB and RPC.`);
  }
};

/**
 * Txids for page [start, end) of the newest-first view of `txids` (which is
 * oldest-first and shared, so it must not be reversed in place).
 */
const newestFirstPage = (txids, start, end) => {
  const page = [];
  for (let j = start; j < end; j++) page.push(txids[txids.length - 1 - j]);
  return page;
};

/**
 * Value of a transaction for an address (same rules as before: outputs to the
 * address, minus spent prevouts of the address; previous transactions are only
 * looked up for txs with at most 5 inputs).
 */
const computeAddressTxValue = async (tx, address) => {
  let value = 0;

  // Check outputs to see if this address received funds
  if (tx.vout) {
    for (const output of tx.vout) {
      if (output.scriptPubKey &&
          output.scriptPubKey.addresses &&
          output.scriptPubKey.addresses.includes(address)) {
        value += parseFloat(output.value || 0);
      }
    }
  }

  // If we have prevout info directly in the transaction, use that
  let isSpend = false;
  if (tx.vin) {
    for (const input of tx.vin) {
      if (input.coinbase) continue;
      if (input.prevout &&
          input.prevout.scriptPubKey &&
          input.prevout.scriptPubKey.addresses &&
          input.prevout.scriptPubKey.addresses.includes(address)) {
        value -= parseFloat(input.prevout.value || 0);
        isSpend = true;
      }
    }
  }

  // Only look up previous transactions if we didn't identify this as a spend
  // and if the transaction has a reasonable number of inputs
  if (!isSpend && tx.vin && tx.vin.length <= 5) {
    const inputs = tx.vin.filter(input => !input.coinbase);
    const prevTxs = await Promise.all(inputs.map(input =>
      bitcoinzService.getRawTransactionPlain(input.txid).catch(prevTxError => {
        logger.warn(`Error fetching previous tx ${input.txid}: ${prevTxError.message}`);
        return null;
      })
    ));
    inputs.forEach((input, i) => {
      const prevTx = prevTxs[i];
      if (prevTx && prevTx.vout && prevTx.vout[input.vout]) {
        const prevOut = prevTx.vout[input.vout];
        if (prevOut.scriptPubKey &&
            prevOut.scriptPubKey.addresses &&
            prevOut.scriptPubKey.addresses.includes(address)) {
          value -= parseFloat(prevOut.value || 0);
        }
      }
    });
  }

  return value;
};

/**
 * Get paginated transactions for an address
 */
const getAddressTransactions = async (address, limit = 25, offset = 0) => {
  try {
    logger.info(`Fetching ${limit} transactions for ${address} starting at offset ${offset}`);

    // Hard page-size limit (also guards against negative values: limit=-1 used
    // to select the whole history of the address)
    const hardLimit = Math.min(Math.max(limit, 1), MAX_PAGE_SIZE);
    offset = Math.max(offset, 0);
    let transactions = [];
    let txCount = 0;
    let latestTxids = null;

    // First try to get data from database if available
    const db = require('../db').getSequelize();
    if (db) {
      try {
        // Only fetch the requested slice of the stored txid array (it can hold
        // 300k entries / 20 MB for busy addresses)
        const [rows] = await db.query(
          `SELECT tx_count AS "txCount",
                  last_updated AS "lastUpdated",
                  COALESCE(cardinality(transactions), 0) AS "storedCount",
                  transactions[$2:$3] AS "pageTxids"
           FROM addresses WHERE address = $1`,
          { bind: [address, offset + 1, offset + hardLimit] }
        );
        const addressRecord = rows[0];

        if (addressRecord && addressRecord.storedCount > 0) {
          txCount = addressRecord.txCount || addressRecord.storedCount;
          logger.info(`Found ${txCount} transactions in database for ${address}`);

          // If the address has been updated recently, use the database data
          const lastUpdated = new Date(addressRecord.lastUpdated).getTime();
          const isRecent = Date.now() - lastUpdated < 3600000; // 1 hour

          if (isRecent) {
            const pageTxids = addressRecord.pageTxids || [];

            if (pageTxids.length > 0) {
              logger.debug(`Attempting to fetch ${pageTxids.length} transactions from DB for address ${address}`);
              const TransactionModel = await require('../models').getTransaction(db);
              const dbTransactions = await TransactionModel.findAll({
                attributes: ['txid', 'time', 'blocktime', 'confirmations', 'vout'],
                where: { txid: pageTxids },
                raw: true
              });
              logger.debug(`Found ${dbTransactions ? dbTransactions.length : 0} transactions in DB query result for address ${address}`);

              // If we found transactions in the database, return them
              if (dbTransactions && dbTransactions.length > 0) {
                logger.info(`Retrieved ${dbTransactions.length} transactions from database for ${address}`);

                // Map transactions to the expected format
                const mappedTransactions = dbTransactions.map(tx => {
                  // Calculate simplified value for this address
                  let value = 0;

                  try {
                    if (tx.vout) {
                      let voutData = tx.vout;
                      if (typeof voutData === 'string') {
                        voutData = JSON.parse(voutData);
                      }

                      if (Array.isArray(voutData)) {
                        for (const output of voutData) {
                          if (output.scriptPubKey &&
                              output.scriptPubKey.addresses &&
                              output.scriptPubKey.addresses.includes(address)) {
                            value += parseFloat(output.value || 0);
                          }
                        }
                      }
                    }
                  } catch (parseError) {
                    logger.warn(`Error parsing vout data for tx ${tx.txid}: ${parseError.message}`);
                  }

                  return {
                    txid: tx.txid,
                    time: tx.time || tx.blocktime || 0,
                    confirmations: tx.confirmations || 0,
                    value: value,
                    isReceived: value >= 0
                  };
                });

                return {
                  address,
                  transactions: mappedTransactions,
                  count: txCount,
                  offset,
                  hasMore: offset + mappedTransactions.length < txCount
                };
              }
            }
          }
        }
      } catch (dbError) {
        logger.warn(`Error fetching from database: ${dbError.message}, falling back to RPC`);
      }
    }

    // If we haven't returned yet, fall back to RPC
    try {
      // Get transaction count from getaddressinfo if available
      if (txCount === 0 && getAddressInfoRpcSupported) {
        try {
          const addressInfo = await bitcoinzService.executeRpcCommand('getaddressinfo', [address], 30000);
          if (addressInfo && typeof addressInfo.txcount === 'number') {
            txCount = addressInfo.txcount;
          }
        } catch (infoError) {
          if (/method not found/i.test(JSON.stringify(infoError.response?.data || '')) || /method not found/i.test(infoError.message)) {
            getAddressInfoRpcSupported = false;
          }
          logger.debug(`getaddressinfo not supported or failed: ${infoError.message}`);
        }
      }

      // Get transaction IDs for this address (one shared call; it used to be
      // requested two or three times per page view)
      const txids = await bitcoinzService.getAddressTxids(address, 60000);
      latestTxids = txids;

      // If we still don't have txCount, get it from getaddresstxids
      if (txCount === 0) {
        txCount = txids ? txids.length : 0;
      }

      // If we have a large number of transactions, warn in logs
      if (txCount > 1000) {
        logger.warn(`Large address detected: ${address} has ${txCount} transactions`);
      }

      if (txids && txids.length > 0) {
        logger.info(`Found ${txids.length} transaction IDs for ${address}`);

        // Newest transactions first
        const start = Math.min(offset, txids.length);
        const end = Math.min(offset + hardLimit, txids.length);
        const pageTxids = newestFirstPage(txids, start, end);

        logger.debug(`Fetching details for ${pageTxids.length} transactions (${start} to ${end})`);

        // Limited concurrency; the RPC layer additionally caps total node load
        const results = [];

        for (let i = 0; i < pageTxids.length; i += TX_FETCH_CONCURRENCY) {
          const batch = pageTxids.slice(i, i + TX_FETCH_CONCURRENCY);
          const batchPromises = batch.map(async (txid) => {
            try {
              const tx = await bitcoinzService.getRawTransactionPlain(txid);

              if (!tx) {
                logger.warn(`No data returned for transaction ${txid}`);
                return null;
              }

              const value = await computeAddressTxValue(tx, address);

              // Save transaction to database if it is missing (in background)
              if (db && CAN_WRITE_DB) {
                saveTransactionToDb(db, tx, address).catch(err => {
                  logger.debug(`Background save failed for tx ${txid}: ${err.message}`);
                });
              }

              return {
                txid: tx.txid,
                time: tx.time || tx.blocktime || Math.floor(Date.now() / 1000),
                confirmations: tx.confirmations || 0,
                value: value,
                isReceived: value >= 0
              };
            } catch (txError) {
              logger.error(`Error processing transaction ${txid}: ${txError.message}`);
              return null;
            }
          });

          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults.filter(r => r !== null));
        }

        // Sort by time (newest first)
        transactions = results.sort((a, b) => b.time - a.time);
      } else {
        logger.warn(`No transactions found for address ${address}`);
      }
    } catch (txidsError) {
      logger.warn(`Error getting txids for ${address}: ${txidsError.message}`);

      // Try importing the address first
      try {
        logger.debug(`Trying importaddress for ${address}`);
        await bitcoinzService.executeRpcCommand('importaddress', [address, '', false], 30000);
        logger.debug(`Successfully imported address ${address}`);

        // Try getting txids again
        const txids = await bitcoinzService.executeRpcCommand('getaddresstxids', [{"addresses": [address]}], 60000);
        latestTxids = txids;
        txCount = txids ? txids.length : 0;

        if (txids && txids.length > 0) {
          logger.info(`After import: Found ${txids.length} transaction IDs for ${address}`);

          // Newest transactions first; just get a sample to avoid overloading
          const start = Math.min(offset, txids.length);
          const end = Math.min(offset + hardLimit, txids.length);
          const sampleTxids = newestFirstPage(txids, start, end);

          const samplePromises = sampleTxids.map(async (txid) => {
            try {
              const tx = await bitcoinzService.getRawTransactionPlain(txid);

              if (!tx) return null;

              return {
                txid: tx.txid,
                time: tx.time || tx.blocktime || Math.floor(Date.now() / 1000),
                confirmations: tx.confirmations || 0,
                value: 0, // Simplified, we don't calculate value here
                isReceived: true
              };
            } catch (txError) {
              logger.error(`Error processing transaction ${txid}: ${txError.message}`);
              return null;
            }
          });

          const sampleResults = await Promise.all(samplePromises);
          transactions = sampleResults.filter(r => r !== null).sort((a, b) => b.time - a.time);
        }
      } catch (importError) {
        logger.error(`Error importing address ${address}: ${importError.message}`);
      }
    }

    // Save address info to database (throttled per address)
    if (db && CAN_WRITE_DB && txCount > 0 && Array.isArray(latestTxids)) {
      saveAddressToDb(db, address, txCount, latestTxids).catch(err => {
        logger.debug(`Background address save failed for ${address}: ${err.message}`);
      });
    }

    return {
      address,
      transactions,
      count: txCount,
      offset,
      hasMore: offset + transactions.length < txCount
    };
  } catch (error) {
    logger.error(`Failed to get transactions for address ${address}:`, error.message);
    throw error;
  }
};

/**
 * Store a transaction fetched via RPC if the indexer doesn't have it yet.
 * Existing (indexer-written) rows are left untouched; this used to upsert and
 * overwrite them with the full RPC JSON on every address page view.
 */
const saveTransactionToDb = async (db, tx, address) => {
  setImmediate(async () => {
    try {
      const TransactionModel = await require('../models').getTransaction(db);

      await TransactionModel.bulkCreate([{
        txid: tx.txid,
        hash: tx.hash,
        version: tx.version,
        size: tx.size,
        vsize: tx.vsize,
        weight: tx.weight,
        locktime: tx.locktime,
        blockhash: tx.blockhash,
        confirmations: tx.confirmations,
        time: tx.time || tx.blocktime,
        blocktime: tx.blocktime,
        vin: tx.vin,
        vout: tx.vout,
        isCoinbase: tx.vin && tx.vin.length > 0 && tx.vin[0].coinbase ? true : false
      }], { ignoreDuplicates: true });
    } catch (error) {
      // Just log and continue, don't throw
      logger.debug(`Error saving transaction ${tx.txid} to database: ${error.message}`);
    }
  });
};

/**
 * Store the address' tx count and txid list (from the getaddresstxids result
 * already fetched for this request). Throttled per address, done in one
 * statement without loading the existing (possibly 20 MB) row, and skipped by
 * Postgres when nothing changed.
 */
const saveAddressToDb = async (db, address, txCount, txids) => {
  const last = addressSaveTimes.get(address);
  if (last && Date.now() - last < ADDRESS_SAVE_MIN_INTERVAL_MS) return;
  addressSaveTimes.set(address, Date.now());

  setImmediate(async () => {
    try {
      await db.query(`
        INSERT INTO addresses (address, tx_count, transactions, last_updated, created_at, updated_at)
        VALUES ($1, $2, $3::text[], NOW(), NOW(), NOW())
        ON CONFLICT (address) DO UPDATE SET
          tx_count = EXCLUDED.tx_count,
          transactions = EXCLUDED.transactions,
          updated_at = NOW()
        WHERE addresses.tx_count IS DISTINCT FROM EXCLUDED.tx_count
           OR COALESCE(cardinality(addresses.transactions), 0) <> COALESCE(cardinality(EXCLUDED.transactions), 0)
      `, { bind: [address, txCount, txids] });
    } catch (error) {
      // Just log and continue, don't throw
      logger.debug(`Error saving address ${address} to database: ${error.message}`);
    }
  });
};

module.exports = {
  getAddressInfo,
  getAddressTransactions
};
