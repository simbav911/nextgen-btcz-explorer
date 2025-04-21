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
const getAddressTransactions = async (address, limit = 10, offset = 0) => {
  try {
    logger.info(`Fetching ${limit} transactions for ${address} starting at offset ${offset}`);
    
    let transactions = [];
    let txCount = 0;
    
    // First get all transaction IDs for this address
    try {
      const txids = await executeRpcCommand('getaddresstxids', [{"addresses": [address]}], 60000);
      txCount = txids ? txids.length : 0;
      
      if (txids && txids.length > 0) {
        logger.info(`Found ${txids.length} transaction IDs for ${address}`);
        
        // Get the right slice of txids for the requested page
        const start = Math.min(offset, txids.length);
        const end = Math.min(offset + limit, txids.length);
        const pageTxids = txids.slice(start, end);
        
        logger.debug(`Fetching details for ${pageTxids.length} transactions (${start} to ${end})`);
        
        // Use limited concurrency to avoid overwhelming the node
        const concurrencyLimit = 5;
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
              
              // Calculate value for this address
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
              
              // Check inputs to see if this address spent funds
              if (tx.vin) {
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
        const txids = await executeRpcCommand('getaddresstxids', [{"addresses": [address]}], 60000);
        txCount = txids ? txids.length : 0;
        
        if (txids && txids.length > 0) {
          logger.info(`After import: Found ${txids.length} transaction IDs for ${address}`);
          
          // Just get a sample of transactions to avoid overloading
          const start = Math.min(offset, txids.length);
          const end = Math.min(offset + limit, txids.length);
          const sampleTxids = txids.slice(start, end);
          
          // Get transaction details
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
    
    return {
      address,
      transactions,
      count: txCount,
      offset
    };
  } catch (error) {
    logger.error(`Failed to get transactions for address ${address}:`, error.message);
    throw error;
  }
};

module.exports = {
  getAddressInfo,
  getAddressTransactions
};
