const logger = require('../utils/logger');
const bitcoinzService = require('./bitcoinzService'); // Use full service for fallbacks
const { Address } = require('../models'); // Import Address model
const { Op } = require('sequelize');

/**
 * Get address details (balance, totals, tx count). Prioritizes DB, falls back to RPC.
 */
const getAddressInfo = async (address) => {
  logger.info(`Fetching address info for ${address} (DB first)`);
  let addressRecord;

  // 1. Try fetching from Database first
  try {
    const AddressModel = await models.getAddress(); // Get Address model instance
    if (!AddressModel) {
      logger.warn('Address model not initialized, falling back to RPC.');
    } else {
      addressRecord = await AddressModel.findByPk(address, { raw: true });
    }

    if (addressRecord) {
      // Optional: Check lastUpdated timestamp if staleness is a concern
      // const isRecent = Date.now() - new Date(addressRecord.lastUpdated).getTime() < 3600000; // e.g., 1 hour
      // if (isRecent) {
      logger.info(`Found address info in DB for ${address}`);
      return {
        address: addressRecord.address,
        balance: addressRecord.balance,
        totalReceived: addressRecord.totalReceived,
        totalSent: addressRecord.totalSent,
        unconfirmedBalance: addressRecord.unconfirmedBalance || 0, // DB doesn't store this, default to 0
        txCount: addressRecord.txCount
      };
      // } else {
      //   logger.info(`DB record for ${address} is stale, proceeding to RPC fallback.`);
      // }
    } else {
      logger.info(`Address ${address} not found in DB, proceeding to RPC fallback.`);
    }
  } catch (dbError) {
    logger.error(`Error fetching address ${address} from DB: ${dbError.message}. Falling back to RPC.`);
  }

  // 2. Fallback to RPC if not found or DB error
  try {
    logger.info(`Fetching address info via RPC for ${address}`);
    let balance = 0;
    let totalReceived = 0;
    let totalSent = 0;
    let unconfirmedBalance = 0; // RPC might provide this, but often requires specific calls
    let txCount = 0;

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
    try {
      const txids = await bitcoinzService.executeRpcCommand('getaddresstxids', [{"addresses": [address]}], 60000);
      txCount = txids ? txids.length : 0;
      logger.info(`Found ${txCount} transactions via getaddresstxids RPC for ${address}`);
    } catch (txidsError) {
      logger.warn(`Error getting txids via RPC for ${address}: ${txidsError.message}`);
      // Don't attempt import here, as it's slow and might not be desired for simple info lookup
    }

    // TODO: Add logic to fetch unconfirmedBalance if needed (e.g., getaddressutxos with 0 conf)

    const rpcData = {
      address,
      balance,
      totalReceived,
      totalSent,
      unconfirmedBalance,
      txCount
    };

    // Optionally: Update DB in background with fetched RPC data
    // Be careful not to overwrite potentially more complete data from syncService
    // saveAddressToDb(db, address, txCount, rpcData).catch(...) // Need db instance and modified save function

    return rpcData;

  } catch (error) {
    logger.error(`Failed to get address info for ${address} via RPC fallback:`, error.message);
    // Re-throw the error if RPC fallback also fails completely
    throw new Error(`Failed to retrieve address info for ${address} from both DB and RPC.`);
  }
};

/**
 * Get paginated transactions for an address
 */
const getAddressTransactions = async (address, limit = 25, offset = 0) => {
  try {
    logger.info(`Fetching ${limit} transactions for ${address} starting at offset ${offset}`);
    
    // Set a reasonable hard limit to prevent overloading
    const hardLimit = Math.min(limit, 100);
    let transactions = [];
    let txCount = 0;
    
    // First try to get data from database if available
    const db = require('../db').getSequelize();
    if (db) {
      try {
        const AddressModel = await require('../models').getAddress(db);
        const addressRecord = await AddressModel.findOne({
          where: { address: address }
        });
        
        if (addressRecord && addressRecord.transactions && addressRecord.transactions.length > 0) {
          txCount = addressRecord.txCount || addressRecord.transactions.length;
          logger.info(`Found ${txCount} transactions in database for ${address}`);
          
          // If the address has been updated recently, use the database data
          const lastUpdated = new Date(addressRecord.lastUpdated).getTime(); // Corrected field name
          const isRecent = Date.now() - lastUpdated < 3600000; // 1 hour
          
          if (isRecent) {
            // Get transaction IDs for the requested page
            const txids = addressRecord.transactions;
            // Get the page of txids
            const pageTxids = txids.slice(offset, offset + hardLimit);
            
            if (pageTxids.length > 0) {
              logger.debug(`Attempting to fetch ${pageTxids.length} transactions from DB for address ${address}`); // Added log
              // Get transactions from database
              const TransactionModel = await require('../models').getTransaction(db);
              const dbTransactions = await TransactionModel.findAll({
                where: { txid: pageTxids } // Reverted back to previous syntax
              });
              logger.debug(`Found ${dbTransactions ? dbTransactions.length : 0} transactions in DB query result for address ${address}`); // Added log
              
              // If we found transactions in the database, return them
              if (dbTransactions && dbTransactions.length > 0) {
                logger.info(`Retrieved ${dbTransactions.length} transactions from database for ${address}`);
                
                // Map transactions to the expected format
                const mappedTransactions = dbTransactions.map(tx => {
                  // Calculate simplified value for this address
                  let value = 0;
                  
                  try {
                    // If we have vout data in the database
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
    // First get all transaction IDs for this address
    try {
      // Check if we already know the txCount
      if (txCount === 0) {
        // Get transaction count from getaddressinfo if available
        try {
          const addressInfo = await bitcoinzService.executeRpcCommand('getaddressinfo', [address], 30000); // Prefixed
          if (addressInfo && typeof addressInfo.txcount === 'number') {
            txCount = addressInfo.txcount;
          }
        } catch (infoError) {
          logger.debug(`getaddressinfo not supported or failed: ${infoError.message}`);
        }
      }
      
      // If we still don't have txCount, get it from getaddresstxids
      if (txCount === 0) {
        let txids = await bitcoinzService.executeRpcCommand('getaddresstxids', [{"addresses": [address]}], 60000); // Prefixed
        txCount = txids ? txids.length : 0;
      }
      
      // If we have a large number of transactions, warn in logs
      if (txCount > 1000) {
        logger.warn(`Large address detected: ${address} has ${txCount} transactions`);
      }
      
      // Get transaction IDs for this address
      let txids = await bitcoinzService.executeRpcCommand('getaddresstxids', [{"addresses": [address]}], 60000); // Prefixed
      
      if (txids && txids.length > 0) {
        logger.info(`Found ${txids.length} transaction IDs for ${address}`);
        
        // IMPORTANT: Reverse the txids array to get newest transactions first
        txids = txids.reverse();
        
        // Now get the right slice of txids for the requested page
        const start = Math.min(offset, txids.length);
        const end = Math.min(offset + hardLimit, txids.length);
        const pageTxids = txids.slice(start, end);
        
        logger.debug(`Fetching details for ${pageTxids.length} transactions (${start} to ${end})`);
        
        // Use limited concurrency to avoid overwhelming the node
        const concurrencyLimit = 3; // Reduced from 5 to lower node load
        const results = [];
        
        for (let i = 0; i < pageTxids.length; i += concurrencyLimit) {
          const batch = pageTxids.slice(i, i + concurrencyLimit);
          const batchPromises = batch.map(async (txid) => {
            try {
              // Get transaction details
              const tx = await bitcoinzService.executeRpcCommand('getrawtransaction', [txid, 1], 30000); // Prefixed
              
              if (!tx) {
                logger.warn(`No data returned for transaction ${txid}`);
                return null;
              }
              
              // Calculate value for this address - BUT AVOID DEEP INPUT LOOKUPS
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
              
              // For inputs, only look up if this transaction explicitly shows 
              // this address spending funds using input.prevout data if available
              let isSpend = false;
              if (tx.vin) {
                for (const input of tx.vin) {
                  if (input.coinbase) continue;
                  
                  // If we have prevout info directly in the transaction, use that
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
                for (const input of tx.vin) {
                  if (input.coinbase) continue;
                  
                  try {
                    const prevTx = await bitcoinzService.executeRpcCommand('getrawtransaction', [input.txid, 1], 20000); // Prefixed
                    if (prevTx && prevTx.vout && prevTx.vout[input.vout]) {
                      const prevOut = prevTx.vout[input.vout];
                      if (prevOut.scriptPubKey && 
                          prevOut.scriptPubKey.addresses && 
                          prevOut.scriptPubKey.addresses.includes(address)) {
                        value -= parseFloat(prevOut.value || 0);
                      }
                    }
                  } catch (prevTxError) {
                    logger.warn(`Error fetching previous tx ${input.txid}: ${prevTxError.message}`);
                  }
                }
              }
              
              // Save transaction to database if available (in background)
              if (db) {
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
          
          // Wait for this batch to complete before starting the next one
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults.filter(r => r !== null));
          
          // Add a small delay between batches to reduce node load
          if (i + concurrencyLimit < pageTxids.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
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
        await bitcoinzService.executeRpcCommand('importaddress', [address, '', false], 30000); // Prefixed
        logger.debug(`Successfully imported address ${address}`);
        
        // Try getting txids again
        let txids = await bitcoinzService.executeRpcCommand('getaddresstxids', [{"addresses": [address]}], 60000); // Prefixed
        txCount = txids ? txids.length : 0;
        
        if (txids && txids.length > 0) {
          logger.info(`After import: Found ${txids.length} transaction IDs for ${address}`);
          
          // IMPORTANT: Reverse txids to get newest transactions first
          txids = txids.reverse();
          
          // Just get a sample of transactions to avoid overloading
          const start = Math.min(offset, txids.length);
          const end = Math.min(offset + hardLimit, txids.length);
          const sampleTxids = txids.slice(start, end);
          
          // Get transaction details with simplified approach
          const samplePromises = sampleTxids.map(async (txid) => {
            try {
              const tx = await bitcoinzService.executeRpcCommand('getrawtransaction', [txid, 1], 30000); // Prefixed
              
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
    
    // Save address info to database if we have a connection
    if (db && txCount > 0) {
      saveAddressToDb(db, address, txCount).catch(err => {
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
 * Helper function to save transaction to database in the background
 */
const saveTransactionToDb = async (db, tx, address) => {
  // Run in next tick to avoid blocking
  setImmediate(async () => {
    try {
      const TransactionModel = await require('../models').getTransaction(db);
      
      // Prepare minimal transaction data to save
      await TransactionModel.upsert({
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
        is_coinbase: tx.vin && tx.vin.length > 0 && tx.vin[0].coinbase ? true : false
      });
    } catch (error) {
      // Just log and continue, don't throw
      logger.debug(`Error saving transaction ${tx.txid} to database: ${error.message}`);
    }
  });
};

/**
 * Helper function to save address to database in the background
 */
const saveAddressToDb = async (db, address, txCount) => {
  // Run in next tick to avoid blocking
  setImmediate(async () => {
    try {
      const AddressModel = await require('../models').getAddress(db);
      
      // Get transaction IDs for this address
      let txids = [];
      try {
        txids = await bitcoinzService.executeRpcCommand('getaddresstxids', [{"addresses": [address]}], 60000); // Prefixed
      } catch (error) {
        logger.debug(`Could not get txids for address ${address}: ${error.message}`);
        // Continue with empty txids array
      }
      
      // Find or create address record
      const [addressRecord, created] = await AddressModel.findOrCreate({
        where: { address },
        defaults: {
          address,
          txCount: txCount,
          transactions: txids || []
        }
      });
      
      // Update existing record
      if (!created) {
        await addressRecord.update({
          txCount: txCount,
          transactions: txids || addressRecord.transactions || [],
          updated_at: new Date()
        });
      }
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
