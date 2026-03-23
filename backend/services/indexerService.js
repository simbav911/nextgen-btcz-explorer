// services/indexerService.js
const logger = require('../utils/logger');
const { executeRpcCommand } = require('./bitcoinzService');
const { getSequelize } = require('../db');
const { getTransaction, getBlock, getAddress } = require('../models');

// Performance tuning constants
const CONCURRENT_BLOCKS = 8;           // Process 8 blocks in parallel
const BLOCKS_PER_RUN = 5000;           // Process up to 5000 blocks per run
const BULK_SYNC_THRESHOLD = 1000;      // Skip vin resolution when this far behind
const CAUGHT_UP_INTERVAL = 5000;       // 5s between runs when caught up
const BEHIND_INTERVAL = 1000;          // 1s between runs when behind
const TX_CACHE_MAX_SIZE = 50000;       // Max entries in vin resolution cache

// Flag to prevent multiple indexing processes running simultaneously
let isIndexing = false;
let lastIndexedBlock = 0;
let isFullyCaughtUp = false;

// In-memory cache for transaction vout data (for vin address resolution)
const txVoutCache = new Map();

const cacheTransactionVout = (txid, voutData) => {
  if (txVoutCache.size >= TX_CACHE_MAX_SIZE) {
    const firstKey = txVoutCache.keys().next().value;
    txVoutCache.delete(firstKey);
  }
  txVoutCache.set(txid, voutData);
};

const getCachedTransactionVout = (txid) => txVoutCache.get(txid) || null;

// Import the address monitor service
const addressMonitorService = require('./addressMonitorService');

// --- Extracted helper functions (module-level for reuse) ---
const processVin = (vinArray) => {
  if (!vinArray || !Array.isArray(vinArray)) return [];
  return vinArray.map(input => ({
    txid: input?.txid,
    vout: input?.vout,
    sequence: input?.sequence,
    coinbase: input?.coinbase,
    address: input?.address || input?.prevout?.scriptPubKey?.addresses?.[0],
    value: input?.value || input?.prevout?.value,
  }));
};

const processVout = (voutArray) => {
  if (!voutArray || !Array.isArray(voutArray)) return [];
  return voutArray.map(output => ({
    value: output?.value,
    n: output?.n,
    scriptPubKey: {
      addresses: output?.scriptPubKey?.addresses || [],
    },
  }));
};

/**
 * Initialize the indexer service
 */
const initializeIndexer = async () => {
  logger.info('Initializing blockchain indexer service');

  // Load the last indexed block from the database first
  try {
    const db = getSequelize();
    if (db) {
      const BlockModel = await getBlock(db);
      const lastBlock = await BlockModel.findOne({
        order: [['height', 'DESC']]
      });

      if (lastBlock) {
        lastIndexedBlock = lastBlock.height;
        logger.info(`Initializing indexer from last synced block: ${lastIndexedBlock}`);
      }
    }
  } catch (error) {
    logger.warn(`Failed to load last indexed block: ${error.message}`);
  }

  // Start the indexing process
  scheduleIndexing();

  // Start the address monitor service to maintain address balances
  addressMonitorService.startMonitoring();
  logger.info('Address balance monitor service started');

  return true;
};

/**
 * Schedule indexing with self-scheduling loop (no fixed interval)
 */
const scheduleIndexing = () => {
  setTimeout(async () => {
    await runIndexingJob();
    // Self-schedule: short delay when behind, longer when caught up
    scheduleIndexing();
  }, isFullyCaughtUp ? CAUGHT_UP_INTERVAL : BEHIND_INTERVAL);
};

/**
 * Run the indexing job - processes blocks in parallel batches
 */
const runIndexingJob = async () => {
  if (isIndexing) {
    logger.debug('Indexing already in progress, skipping this run');
    return;
  }

  isIndexing = true;

  try {
    const db = getSequelize();
    if (!db) {
      logger.warn('Database not available, skipping indexing');
      isIndexing = false;
      return;
    }

    // Get current blockchain height
    const blockchainInfo = await executeRpcCommand('getblockchaininfo', [], 30000);
    if (!blockchainInfo || typeof blockchainInfo.blocks !== 'number') {
      logger.error('Failed to get blockchain info');
      isIndexing = false;
      return;
    }

    const currentHeight = blockchainInfo.blocks;

    // If this is the first run, get the last indexed block from the database
    if (lastIndexedBlock === 0) {
      const BlockModel = await getBlock(db);
      const lastBlock = await BlockModel.findOne({
        order: [['height', 'DESC']]
      });

      if (lastBlock) {
        lastIndexedBlock = lastBlock.height;
        logger.info(`Resuming indexing from block ${lastIndexedBlock}`);
      } else {
        lastIndexedBlock = 0;
        logger.info(`No indexed blocks found. Starting initial sync from block 1.`);
      }
    }

    const blocksRemaining = currentHeight - lastIndexedBlock;

    if (blocksRemaining <= 0) {
      isFullyCaughtUp = true;
      isIndexing = false;
      return;
    }

    isFullyCaughtUp = false;
    const isBulkSync = blocksRemaining > BULK_SYNC_THRESHOLD;
    const blocksToProcess = Math.min(BLOCKS_PER_RUN, blocksRemaining);

    logger.info(`Indexing ${blocksToProcess} blocks from ${lastIndexedBlock + 1} to ${lastIndexedBlock + blocksToProcess} (bulk=${isBulkSync}, remaining=${blocksRemaining})`);

    // Process blocks in parallel batches of CONCURRENT_BLOCKS
    for (let i = 0; i < blocksToProcess; i += CONCURRENT_BLOCKS) {
      const batchSize = Math.min(CONCURRENT_BLOCKS, blocksToProcess - i);
      const batchPromises = [];

      for (let j = 0; j < batchSize; j++) {
        const blockHeight = lastIndexedBlock + 1 + i + j;
        batchPromises.push(indexBlock(blockHeight, isBulkSync));
      }

      const results = await Promise.allSettled(batchPromises);

      // Count successes
      let successCount = 0;
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value === true) {
          successCount++;
        } else if (result.status === 'rejected') {
          logger.error(`Block indexing failed: ${result.reason?.message}`);
        }
      }

      // Update lastIndexedBlock after each batch
      lastIndexedBlock += batchSize;

      // Log progress periodically
      if ((i + batchSize) % 100 < CONCURRENT_BLOCKS || i + batchSize >= blocksToProcess) {
        const pct = ((lastIndexedBlock / currentHeight) * 100).toFixed(2);
        logger.info(`Progress: ${lastIndexedBlock}/${currentHeight} (${pct}%) - batch ${successCount}/${batchSize} OK`);
      }
    }

    logger.info(`Indexing run complete. Last indexed block: ${lastIndexedBlock}`);
  } catch (error) {
    logger.error('Error during blockchain indexing:', error);
  } finally {
    isIndexing = false;
  }
};

/**
 * Index a single block and its transactions
 * @param {number} height - Block height to index
 * @param {boolean} isBulkSync - If true, skip expensive vin address resolution
 */
const indexBlock = async (height, isBulkSync = false) => {
  try {
    // Get block hash
    const blockHash = await executeRpcCommand('getblockhash', [height], 20000);
    if (!blockHash) {
      logger.warn(`[IndexBlock ${height}] Failed to get block hash.`);
      return false;
    }

    // Get block details with full transaction data
    const blockDetails = await executeRpcCommand('getblock', [blockHash, 2], 30000);
    if (!blockDetails) {
      logger.warn(`[IndexBlock ${height}] Failed to get details for block hash ${blockHash}`);
      return false;
    }

    // Save block to database
    const db = getSequelize();
    const BlockModel = await getBlock(db);

    await BlockModel.upsert({
      hash: blockDetails.hash,
      height: blockDetails.height,
      confirmations: blockDetails.confirmations,
      size: blockDetails.size,
      strippedsize: blockDetails.strippedsize,
      weight: blockDetails.weight,
      version: blockDetails.version,
      version_hex: blockDetails.versionHex,
      merkleroot: blockDetails.merkleroot,
      tx: blockDetails.tx.map(tx => typeof tx === 'object' ? tx.txid : tx),
      time: blockDetails.time,
      mediantime: blockDetails.mediantime,
      nonce: blockDetails.nonce,
      bits: blockDetails.bits,
      difficulty: blockDetails.difficulty,
      chainwork: blockDetails.chainwork,
      previousblockhash: blockDetails.previousblockhash,
      nextblockhash: blockDetails.nextblockhash
    });

    // Process transactions
    const TransactionModel = await getTransaction(db);
    const addressesMap = new Map();
    const txDetails = Array.isArray(blockDetails.tx) ? blockDetails.tx : [];
    const txRecords = [];

    for (const tx of txDetails) {
      if (typeof tx !== 'object' || !tx.txid) continue;

      const processedVin = processVin(tx.vin);
      const processedVout = processVout(tx.vout);

      // Cache this transaction's vout for future vin lookups
      cacheTransactionVout(tx.txid, processedVout);

      // Collect transaction record for bulk insert
      txRecords.push({
        txid: tx.txid,
        hash: tx.hash,
        version: tx.version,
        size: tx.size,
        vsize: tx.vsize,
        weight: tx.weight,
        locktime: tx.locktime,
        blockhash: blockDetails.hash,
        confirmations: tx.confirmations || blockDetails.confirmations,
        time: tx.time || blockDetails.time,
        blocktime: tx.blocktime || blockDetails.time,
        vin: processedVin,
        vout: processedVout,
        is_coinbase: tx.vin && tx.vin.length > 0 && tx.vin[0].coinbase ? true : false,
        valueBalance: tx.valueBalance,
        fOverwintered: tx.fOverwintered,
        vShieldedSpend: tx.vShieldedSpend,
        vShieldedOutput: tx.vShieldedOutput,
        bindingSig: tx.bindingSig
      });

      // Extract addresses from outputs (always do this)
      if (tx.vout) {
        for (const vout of tx.vout) {
          if (vout.scriptPubKey && vout.scriptPubKey.addresses) {
            for (const addr of vout.scriptPubKey.addresses) {
              if (!addressesMap.has(addr)) {
                addressesMap.set(addr, { txids: new Set(), received: 0, sent: 0 });
              }
              addressesMap.get(addr).txids.add(tx.txid);
              addressesMap.get(addr).received += parseFloat(vout.value || 0);
            }
          }
        }
      }

      // Extract addresses from inputs (skip during bulk sync for speed)
      if (!isBulkSync && tx.vin) {
        for (const vin of tx.vin) {
          if (vin.coinbase) continue;

          try {
            // 3-tier lookup: cache -> DB -> RPC
            let voutData = getCachedTransactionVout(vin.txid);

            if (!voutData) {
              const prevTx = await TransactionModel.findOne({
                where: { txid: vin.txid },
                attributes: ['vout'],
                raw: true
              });
              if (prevTx) {
                voutData = typeof prevTx.vout === 'string' ? JSON.parse(prevTx.vout) : prevTx.vout;
                cacheTransactionVout(vin.txid, voutData);
              }
            }

            if (!voutData) {
              const rawPrevTx = await executeRpcCommand('getrawtransaction', [vin.txid, 1], 20000);
              if (rawPrevTx) {
                voutData = processVout(rawPrevTx.vout);
                cacheTransactionVout(vin.txid, voutData);
              }
            }

            if (voutData) {
              const voutIndex = vin.vout;
              if (voutData[voutIndex]) {
                const prevOut = voutData[voutIndex];
                const addresses = prevOut.scriptPubKey?.addresses || [];
                for (const addr of addresses) {
                  if (!addressesMap.has(addr)) {
                    addressesMap.set(addr, { txids: new Set(), received: 0, sent: 0 });
                  }
                  addressesMap.get(addr).txids.add(tx.txid);
                  addressesMap.get(addr).sent += parseFloat(prevOut.value || 0);
                }
              }
            }
          } catch (prevTxError) {
            logger.warn(`Error processing previous transaction ${vin.txid}: ${prevTxError.message}`);
          }
        }
      }
    } // End transaction loop

    // Bulk insert all transactions for this block
    if (txRecords.length > 0) {
      try {
        await TransactionModel.bulkCreate(txRecords, {
          updateOnDuplicate: ['blockhash', 'confirmations', 'vin', 'vout', 'time', 'blocktime']
        });
      } catch (bulkError) {
        logger.warn(`[IndexBlock ${height}] Bulk tx insert failed, falling back to individual: ${bulkError.message}`);
        for (const txData of txRecords) {
          try {
            await TransactionModel.upsert(txData);
          } catch (e) {
            logger.error(`[IndexBlock ${height}] Failed to upsert tx ${txData.txid}: ${e.message}`);
          }
        }
      }
    }

    // Batch address upsert using raw SQL
    if (addressesMap.size > 0) {
      try {
        const values = [];
        const params = [];
        let paramIndex = 1;

        for (const [addr, data] of addressesMap.entries()) {
          const txidsArray = [...data.txids];
          values.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}::varchar[], NOW(), NOW())`);
          params.push(
            addr,
            Math.max(0, data.received - data.sent),
            data.received,
            data.sent,
            txidsArray.length,
            txidsArray
          );
          paramIndex += 6;
        }

        const sql = `
          INSERT INTO addresses (address, balance, total_received, total_sent, tx_count, transactions, created_at, updated_at)
          VALUES ${values.join(', ')}
          ON CONFLICT (address) DO UPDATE SET
            balance = GREATEST(0, (addresses.total_received + EXCLUDED.total_received) - (addresses.total_sent + EXCLUDED.total_sent)),
            total_received = addresses.total_received + EXCLUDED.total_received,
            total_sent = addresses.total_sent + EXCLUDED.total_sent,
            tx_count = addresses.tx_count + EXCLUDED.tx_count,
            updated_at = NOW()
        `;

        await db.query(sql, { bind: params });
      } catch (sqlError) {
        logger.warn(`[IndexBlock ${height}] Batch address upsert failed: ${sqlError.message}`);
        // Fallback to individual updates
        const AddressModel = await getAddress(db);
        for (const [addr, data] of addressesMap.entries()) {
          try {
            const existing = await AddressModel.findOne({ where: { address: addr } });
            if (existing) {
              const newReceived = Number(existing.total_received || 0) + Number(data.received || 0);
              const newSent = Number(existing.total_sent || 0) + Number(data.sent || 0);
              await AddressModel.update({
                total_received: newReceived,
                total_sent: newSent,
                balance: Math.max(0, newReceived - newSent),
                txCount: (existing.txCount || 0) + data.txids.size,
                updated_at: new Date()
              }, { where: { address: addr } });
            } else {
              await AddressModel.create({
                address: addr,
                balance: Math.max(0, data.received - data.sent),
                total_received: data.received,
                total_sent: data.sent,
                unconfirmed_balance: 0,
                txCount: data.txids.size,
                transactions: [...data.txids]
              });
            }
          } catch (addrError) {
            logger.error(`[IndexBlock ${height}] Error updating address ${addr}: ${addrError.message}`);
          }
        }
      }
    }

    return true;
  } catch (error) {
    logger.error(`[IndexBlock ${height}] Error during indexing: ${error.message}`);
    return false;
  }
};

module.exports = {
  initializeIndexer,
  runIndexingJob,
  getLastIndexedBlock: () => lastIndexedBlock
};
