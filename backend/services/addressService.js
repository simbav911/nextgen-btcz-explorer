const logger = require('../utils/logger');
const { executeRpcCommand } = require('./bitcoinzService');

/**
 * Get address details and transactions
 */
const getAddressInfo = async (address) => {
  try {
    logger.info(`Fetching address info for ${address}`);
    
    // Initialize data
    let balance = 0;
    let totalReceived = 0;
    let totalSent = 0;
    let unconfirmedBalance = 0;
    let txCount = 0;
    
    // Try to use getaddressbalance RPC to get accurate balances
    try {
      const balanceResult = await executeRpcCommand('getaddressbalance', [{"addresses": [address]}], 60000);
      
      if (balanceResult && typeof balanceResult.balance !== 'undefined' && typeof balanceResult.received !== 'undefined') {
        // Convert satoshis to BTCZ (divide by 10^8)
        balance = parseFloat(balanceResult.balance) / 100000000;
        totalReceived = parseFloat(balanceResult.received) / 100000000;
        totalSent = totalReceived - balance;
        
        logger.info(`Got balance from getaddressbalance for ${address}: ${balance} BTCZ, received: ${totalReceived} BTCZ`);
      } else {
        logger.warn(`Invalid getaddressbalance response for ${address}`);
      }
    } catch (balanceError) {
      logger.warn(`Error getting address balance via RPC for ${address}: ${balanceError.message}`);
      
      // Fall back to using listunspent
      try {
        const utxos = await executeRpcCommand('listunspent', [0, 9999999, [address]], 60000);
        logger.debug(`Found ${utxos.length} UTXOs for address ${address}`);
        
        for (const utxo of utxos) {
          balance += utxo.amount;
        }
        
        // For simplicity, assume totalReceived = balance since we don't have better data
        totalReceived = balance;
      } catch (utxoError) {
        logger.error(`Error fetching UTXOs for ${address}: ${utxoError.message}`);
      }
    }
    
    // Get transaction count using getaddresstxids
    try {
      const txids = await executeRpcCommand('getaddresstxids', [{"addresses": [address]}], 60000);
      txCount = txids ? txids.length : 0;
      logger.info(`Found ${txCount} transactions for address ${address}`);
    } catch (txidsError) {
      logger.warn(`Error getting txids for ${address}: ${txidsError.message}`);
      
      // If we can't get transaction count, try importing the address first
      try {
        logger.debug(`Trying importaddress for ${address}`);
        await executeRpcCommand('importaddress', [address, '', false], 60000);
        logger.debug(`Successfully imported address ${address}`);
        
        // Try getting txids again
        const txids = await executeRpcCommand('getaddresstxids', [{"addresses": [address]}], 60000);
        txCount = txids ? txids.length : 0;
        logger.info(`After import: Found ${txCount} transactions for ${address}`);
      } catch (importError) {
        logger.error(`Error importing address ${address}: ${importError.message}`);
      }
    }
    
    // Return the address information without transactions
    // Transactions will be fetched separately with pagination
    return {
      address,
      balance,
      totalReceived,
      totalSent,
      unconfirmedBalance,
      txCount
    };
  } catch (error) {
    logger.error(`Failed to get address info for ${address}:`, error.message);
    throw error;
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
          const lastUpdated = new Date(addressRecord.updated_at).getTime();
          const isRecent = Date.now() - lastUpdated < 3600000; // 1 hour
          
          if (isRecent) {
            // Get transaction IDs for the requested page
            const txids = addressRecord.transactions;
            // Get the page of txids
            const pageTxids = txids.slice(offset, offset + hardLimit);
            
            if (pageTxids.length > 0) {
              // Get transactions from database
              const TransactionModel = await require('../models').getTransaction(db);
              const dbTransactions = await TransactionModel.findAll({
                where: { txid: pageTxids }
              });
              
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
          const addressInfo = await executeRpcCommand('getaddressinfo', [address], 30000);
          if (addressInfo && typeof addressInfo.txcount === 'number') {
            txCount = addressInfo.txcount;
          }
        } catch (infoError) {
          logger.debug(`getaddressinfo not supported or failed: ${infoError.message}`);
        }
      }
      
      // If we still don't have txCount, get it from getaddresstxids
      if (txCount === 0) {
        let txids = await executeRpcCommand('getaddresstxids', [{"addresses": [address]}], 60000);
        txCount = txids ? txids.length : 0;
      }
      
      // If we have a large number of transactions, warn in logs
      if (txCount > 1000) {
        logger.warn(`Large address detected: ${address} has ${txCount} transactions`);
      }
      
      // Get transaction IDs for this address
      let txids = await executeRpcCommand('getaddresstxids', [{"addresses": [address]}], 60000);
      
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
              const tx = await executeRpcCommand('getrawtransaction', [txid, 1], 30000);
              
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
                    const prevTx = await executeRpcCommand('getrawtransaction', [input.txid, 1], 20000);
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
        await executeRpcCommand('importaddress', [address, '', false], 30000);
        logger.debug(`Successfully imported address ${address}`);
        
        // Try getting txids again
        let txids = await executeRpcCommand('getaddresstxids', [{"addresses": [address]}], 60000);
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
              const tx = await executeRpcCommand('getrawtransaction', [txid, 1], 30000);
              
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
        txids = await executeRpcCommand('getaddresstxids', [{"addresses": [address]}], 60000);
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
