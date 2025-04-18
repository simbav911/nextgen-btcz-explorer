const axios = require('axios');
const logger = require('../utils/logger');

let rpcClient = null;

/**
 * Initialize the BitcoinZ node connection
 */
const initializeNodeConnection = async () => {
  const rpcOptions = {
    host: process.env.BITCOINZ_RPC_HOST,
    port: process.env.BITCOINZ_RPC_PORT,
    user: process.env.BITCOINZ_RPC_USER,
    pass: process.env.BITCOINZ_RPC_PASS,
    protocol: 'http'
  };

  // Create the RPC client
  rpcClient = {
    url: `${rpcOptions.protocol}://${rpcOptions.host}:${rpcOptions.port}`,
    auth: {
      username: rpcOptions.user,
      password: rpcOptions.pass
    }
  };

  // Test connection with longer timeout
  try {
    const info = await getBlockchainInfo();
    logger.info(`Connected to BitcoinZ node. Version: ${info.version}, Blocks: ${info.blocks}`);
    return info;
  } catch (error) {
    logger.error('Failed to connect to BitcoinZ node:', error.message);
    throw error;
  }
};

/**
 * Execute an RPC command to the BitcoinZ node
 */
const executeRpcCommand = async (method, params = [], timeout = 30000) => {
  if (!rpcClient) {
    throw new Error('BitcoinZ node not initialized');
  }

  try {
    logger.debug(`Executing RPC command: ${method} with params: ${JSON.stringify(params)}`);
    
    const response = await axios.post(rpcClient.url, {
      jsonrpc: '1.0',
      id: 'bitcoinz-explorer',
      method: method,
      params: params
    }, {
      auth: rpcClient.auth,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: timeout
    });

    if (response.data.error) {
      throw new Error(`RPC Error: ${response.data.error.message}`);
    }

    return response.data.result;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      logger.error(`RPC command '${method}' timed out after ${timeout}ms`);
      throw new Error(`RPC command timed out: ${method}`);
    }
    
    logger.error(`RPC command '${method}' failed:`, error.message);
    throw error;
  }
};

/**
 * Get blockchain info
 */
const getBlockchainInfo = async () => {
  return executeRpcCommand('getblockchaininfo');
};

/**
 * Get the latest block hash
 */
const getBestBlockHash = async () => {
  return executeRpcCommand('getbestblockhash');
};

/**
 * Get block by hash
 */
const getBlock = async (hash, verbosity = 1) => {
  return executeRpcCommand('getblock', [hash, verbosity]);
};

/**
 * Get block by height
 */
const getBlockByHeight = async (height, verbosity = 1) => {
  try {
    const hash = await executeRpcCommand('getblockhash', [height]);
    return getBlock(hash, verbosity);
  } catch (error) {
    logger.error(`Failed to get block at height ${height}:`, error.message);
    throw error;
  }
};

/**
 * Get transaction details
 */
const getTransaction = async (txid, includeWatchonly = true) => {
  try {
    return executeRpcCommand('gettransaction', [txid, includeWatchonly]);
  } catch (error) {
    // For transactions not in the wallet, try getrawtransaction instead
    if (error.message && error.message.includes('Invalid or non-wallet transaction id')) {
      return getRawTransaction(txid, 1);
    }
    throw error;
  }
};

/**
 * Get raw transaction details
 */
const getRawTransaction = async (txid, verbose = 1) => {
  try {
    const transaction = await executeRpcCommand('getrawtransaction', [txid, verbose]);
    
    // For shielded transactions, ensure we properly process all components
    if (verbose === 1 && transaction) {
      // Process valueBalance for shielded transactions
      if (transaction.valueBalance !== undefined) {
        logger.debug(`Processing shielded transaction: ${txid}`);
        
        // Ensure vShieldedSpend and vShieldedOutput are properly formatted
        if (!transaction.vShieldedSpend) {
          transaction.vShieldedSpend = [];
        }
        
        if (!transaction.vShieldedOutput) {
          transaction.vShieldedOutput = [];
        }
        
        // Log shielded transaction details for debugging
        logger.debug(`Shielded transaction details: valueBalance=${transaction.valueBalance}, spends=${transaction.vShieldedSpend.length}, outputs=${transaction.vShieldedOutput.length}`);
      }
      
      // Process transparent inputs (vin) to extract addresses and values when possible
      if (transaction.vin && transaction.vin.length > 0) {
        for (const input of transaction.vin) {
          // Skip coinbase inputs
          if (input.coinbase) continue;
          
          // If input doesn't have address or value, try to get them from the previous output
          if (input.txid && input.vout !== undefined && (!input.address || input.value === undefined)) {
            try {
              const prevTx = await executeRpcCommand('getrawtransaction', [input.txid, 1]);
              if (prevTx && prevTx.vout && prevTx.vout[input.vout]) {
                const prevOutput = prevTx.vout[input.vout];
                
                // Extract address from previous output
                if (prevOutput.scriptPubKey && prevOutput.scriptPubKey.addresses && prevOutput.scriptPubKey.addresses.length > 0) {
                  input.address = prevOutput.scriptPubKey.addresses[0];
                }
                
                // Extract value from previous output
                if (prevOutput.value !== undefined) {
                  input.value = prevOutput.value;
                }
              }
            } catch (err) {
              logger.error(`Failed to fetch previous transaction ${input.txid}: ${err.message}`);
            }
          }
        }
      }
    }
    
    return transaction;
  } catch (error) {
    logger.error(`Failed to get raw transaction ${txid}:`, error.message);
    throw error;
  }
};

/**
 * Get latest transactions
 */
const getLatestTransactions = async (count = 10) => {
  try {
    const bestBlockHash = await getBestBlockHash();
    let block = await getBlock(bestBlockHash, 1);
    
    let transactions = [];
    let blocksChecked = 0;
    const MAX_BLOCKS = 10; // Limit how many blocks we check
    
    // Collect transactions from recent blocks until we have enough
    while (transactions.length < count && blocksChecked < MAX_BLOCKS) {
      const txids = block.tx;
      logger.debug(`Block ${block.height} has ${txids.length} transactions`);
      
      // Get a batch of transactions (first N from this block)
      const batchSize = Math.min(txids.length, count - transactions.length);
      const batchTxids = txids.slice(0, batchSize);
      
      logger.debug(`Fetching ${batchTxids.length} transactions from block ${block.height}`);
      
      // Fetch transactions in parallel with individual timeouts
      const txPromises = batchTxids.map(txid => 
        getRawTransaction(txid, 1).catch(err => {
          logger.error(`Failed to fetch transaction ${txid}: ${err.message}`);
          return null;
        })
      );
      
      const results = await Promise.all(txPromises);
      const validResults = results.filter(tx => tx !== null);
      transactions = transactions.concat(validResults);
      
      // Move to the previous block if we need more transactions
      if (transactions.length < count && block.previousblockhash) {
        block = await getBlock(block.previousblockhash, 1);
      } else {
        break;
      }
      
      blocksChecked++;
    }
    
    logger.info(`Retrieved ${transactions.length} transactions from ${blocksChecked + 1} blocks`);
    return transactions;
  } catch (error) {
    logger.error('Failed to get latest transactions:', error.message);
    throw error;
  }
};

/**
 * Get network stats
 */
const getNetworkStats = async () => {
  try {
    const [blockchainInfo, networkInfo, miningInfo] = await Promise.all([
      executeRpcCommand('getblockchaininfo'),
      executeRpcCommand('getnetworkinfo'),
      executeRpcCommand('getmininginfo')
    ]);
    
    return {
      blockchainInfo,
      networkInfo,
      miningInfo
    };
  } catch (error) {
    logger.error('Failed to get network stats:', error.message);
    throw error;
  }
};

/**
 * Get address balance and transactions
 */
const getAddressInfo = async (address) => {
  try {
    logger.info(`Fetching address info for ${address}`);
    
    // Initialize variables to track address statistics
    let balance = 0;
    let totalReceived = 0;
    let totalSent = 0;
    let unconfirmedBalance = 0;
    let transactions = [];
    let txIds = new Set();
    
    // Get unspent transaction outputs (UTXOs) for the address
    logger.debug(`Executing listunspent for address ${address}`);
    try {
      const utxos = await executeRpcCommand('listunspent', [0, 9999999, [address]]);
      logger.debug(`Found ${utxos.length} UTXOs for address ${address}`);
      
      // Calculate confirmed balance from UTXOs
      for (const utxo of utxos) {
        balance += utxo.amount;
        
        // Add transaction to our set if not already included
        if (!txIds.has(utxo.txid)) {
          txIds.add(utxo.txid);
        }
      }
    } catch (utxoError) {
      logger.error(`Error fetching UTXOs for ${address}: ${utxoError.message}`);
    }
    
    // Try a different approach - use z_listreceivedbyaddress if it's available (for transparent addresses too)
    try {
      logger.debug(`Trying z_listreceivedbyaddress for ${address}`);
      const receivedTxs = await executeRpcCommand('z_listreceivedbyaddress', [address, 0]);
      logger.debug(`Found ${receivedTxs.length} received transactions for ${address} using z_listreceivedbyaddress`);
      
      for (const tx of receivedTxs) {
        // Add to transaction IDs set if not already included
        if (!txIds.has(tx.txid)) {
          txIds.add(tx.txid);
        }
        
        // Add to total received
        totalReceived += tx.amount;
      }
    } catch (zListError) {
      logger.warn(`z_listreceivedbyaddress not available or failed for ${address}: ${zListError.message}`);
    }
    
    // Try to get transactions if the address is in the wallet
    try {
      logger.debug(`Trying listtransactions for ${address}`);
      const walletTxs = await executeRpcCommand('listtransactions', ['*', 100, 0, true]);
      let addressTxs = walletTxs.filter(tx => tx.address === address);
      logger.debug(`Found ${addressTxs.length} transactions for ${address} in wallet`);
      
      for (const tx of addressTxs) {
        // Add to transaction IDs set if not already included
        if (!txIds.has(tx.txid)) {
          txIds.add(tx.txid);
        }
        
        // Calculate received and sent amounts
        if (tx.category === 'receive') {
          totalReceived += tx.amount;
        } else if (tx.category === 'send') {
          totalSent += Math.abs(tx.amount);
        }
        
        // Track unconfirmed balance
        if (tx.confirmations === 0) {
          if (tx.category === 'receive') {
            unconfirmedBalance += tx.amount;
          } else if (tx.category === 'send') {
            unconfirmedBalance -= Math.abs(tx.amount);
          }
        }
      }
    } catch (walletError) {
      logger.warn(`Could not get wallet transactions for ${address}: ${walletError.message}`);
    }
    
    // Try using importaddress to add the address to the wallet temporarily
    // This can be resource-intensive but helps with addresses not in the wallet
    if (txIds.size === 0) {
      try {
        logger.debug(`No transactions found for ${address}, trying importaddress`);
        // Use rescan=false to avoid rescanning the entire blockchain
        await executeRpcCommand('importaddress', [address, '', false]);
        logger.debug(`Successfully imported address ${address}`);
        
        // Try listunspent again after import
        const utxos = await executeRpcCommand('listunspent', [0, 9999999, [address]]);
        logger.debug(`After import: Found ${utxos.length} UTXOs for address ${address}`);
        
        // Calculate confirmed balance from UTXOs
        for (const utxo of utxos) {
          balance += utxo.amount;
          
          // Add transaction to our set if not already included
          if (!txIds.has(utxo.txid)) {
            txIds.add(utxo.txid);
          }
        }
      } catch (importError) {
        logger.error(`Error importing address ${address}: ${importError.message}`);
      }
    }
    
    // If we have transaction IDs, fetch each transaction and analyze inputs/outputs
    if (txIds.size > 0) {
      logger.debug(`Fetching ${txIds.size} transactions for address ${address}`);
      
      for (const txid of txIds) {
        try {
          const tx = await getRawTransaction(txid, 1);
          
          // Process outputs (vout) to find receives
          if (tx.vout) {
            for (const output of tx.vout) {
              if (output.scriptPubKey && 
                  output.scriptPubKey.addresses && 
                  output.scriptPubKey.addresses.includes(address)) {
                // Only count towards totalReceived if not already counted
                if (totalReceived === 0) {
                  totalReceived += output.value;
                }
              }
            }
          }
          
          // Process inputs (vin) to find sends
          if (tx.vin) {
            for (const input of tx.vin) {
              // Skip coinbase inputs
              if (input.coinbase) continue;
              
              // We need to get the previous transaction to check if the address was the sender
              if (input.txid && input.vout !== undefined) {
                try {
                  const prevTx = await getRawTransaction(input.txid, 1);
                  if (prevTx && 
                      prevTx.vout && 
                      prevTx.vout[input.vout] && 
                      prevTx.vout[input.vout].scriptPubKey && 
                      prevTx.vout[input.vout].scriptPubKey.addresses && 
                      prevTx.vout[input.vout].scriptPubKey.addresses.includes(address)) {
                    // Only count towards totalSent if not already counted
                    if (totalSent === 0) {
                      totalSent += prevTx.vout[input.vout].value;
                    }
                  }
                } catch (prevTxError) {
                  logger.error(`Failed to fetch previous transaction ${input.txid}: ${prevTxError.message}`);
                }
              }
            }
          }
          
          // Add transaction to our list with formatted data
          transactions.push({
            txid: tx.txid,
            time: tx.time,
            confirmations: tx.confirmations || 0,
            isReceived: tx.vout.some(out => 
              out.scriptPubKey && 
              out.scriptPubKey.addresses && 
              out.scriptPubKey.addresses.includes(address)
            ),
            vin: tx.vin,
            vout: tx.vout
          });
        } catch (txError) {
          logger.error(`Failed to process transaction ${txid}: ${txError.message}`);
        }
      }
    } else {
      logger.warn(`No transactions found for address ${address} after all attempts`);
    }
    
    // If balance is still 0 but we have transactions, try to calculate balance from transactions
    if (balance === 0 && transactions.length > 0) {
      logger.debug(`Calculating balance from transactions for ${address}`);
      
      // Sort transactions by time (oldest first)
      transactions.sort((a, b) => a.time - b.time);
      
      // Calculate running balance
      let runningBalance = 0;
      
      for (const tx of transactions) {
        // Check outputs (vout) for receives
        for (const output of tx.vout) {
          if (output.scriptPubKey && 
              output.scriptPubKey.addresses && 
              output.scriptPubKey.addresses.includes(address)) {
            runningBalance += output.value;
          }
        }
        
        // Check inputs (vin) for sends
        for (const input of tx.vin) {
          // Skip coinbase inputs
          if (input.coinbase) continue;
          
          // Check if this input references a previous output owned by this address
          if (input.prevout && 
              input.prevout.scriptPubKey && 
              input.prevout.scriptPubKey.addresses && 
              input.prevout.scriptPubKey.addresses.includes(address)) {
            runningBalance -= input.prevout.value;
          }
        }
      }
      
      // Update balance if we calculated a non-zero value
      if (runningBalance > 0) {
        balance = runningBalance;
      }
    }
    
    // Sort transactions by time (newest first)
    transactions.sort((a, b) => b.time - a.time);
    
    // If we still have no data, try one last approach - search for the address in recent blocks
    if (txIds.size === 0) {
      logger.debug(`No transactions found for ${address}, searching in recent blocks`);
      
      try {
        // Get the latest block hash
        const bestBlockHash = await getBestBlockHash();
        let currentBlockHash = bestBlockHash;
        
        // Search through the last 10 blocks
        for (let i = 0; i < 10; i++) {
          if (!currentBlockHash) break;
          
          const block = await getBlock(currentBlockHash, 2); // Verbosity 2 includes transaction details
          
          // Check each transaction in the block
          for (const tx of block.tx) {
            let found = false;
            
            // Check outputs
            for (const vout of tx.vout) {
              if (vout.scriptPubKey && 
                  vout.scriptPubKey.addresses && 
                  vout.scriptPubKey.addresses.includes(address)) {
                found = true;
                txIds.add(tx.txid);
                totalReceived += vout.value;
                
                // Add transaction to our list
                transactions.push({
                  txid: tx.txid,
                  time: block.time,
                  confirmations: block.confirmations || 0,
                  isReceived: true,
                  vin: tx.vin,
                  vout: tx.vout
                });
                
                break;
              }
            }
            
            // Check inputs if not already found
            if (!found) {
              for (const vin of tx.vin) {
                if (vin.prevout && 
                    vin.prevout.scriptPubKey && 
                    vin.prevout.scriptPubKey.addresses && 
                    vin.prevout.scriptPubKey.addresses.includes(address)) {
                  txIds.add(tx.txid);
                  totalSent += vin.prevout.value;
                  
                  // Add transaction to our list
                  transactions.push({
                    txid: tx.txid,
                    time: block.time,
                    confirmations: block.confirmations || 0,
                    isReceived: false,
                    vin: tx.vin,
                    vout: tx.vout
                  });
                  
                  break;
                }
              }
            }
          }
          
          // Move to the previous block
          currentBlockHash = block.previousblockhash;
        }
      } catch (blockSearchError) {
        logger.error(`Error searching for address in blocks: ${blockSearchError.message}`);
      }
    }
    
    logger.info(`Completed address info fetch for ${address}: found ${txIds.size} transactions, balance: ${balance}`);
    
    return {
      address,
      balance,
      totalReceived,
      totalSent,
      unconfirmedBalance,
      txCount: txIds.size,
      transactions: transactions.slice(0, 10) // Return only the first 10 transactions
    };
  } catch (error) {
    logger.error(`Failed to get address info for ${address}:`, error.message);
    throw error;
  }
};

/**
 * Get address transactions
 */
const getAddressTransactions = async (address, limit = 10, offset = 0) => {
  try {
    // Get the full address info first
    const addressInfo = await getAddressInfo(address);
    
    // Return the paginated transactions
    return {
      address,
      transactions: addressInfo.transactions.slice(offset, offset + limit),
      count: addressInfo.txCount,
      offset
    };
  } catch (error) {
    logger.error(`Failed to get transactions for address ${address}:`, error.message);
    throw error;
  }
};

/**
 * Get address balance history
 * Note: This requires historical data which may not be directly available from the node
 * For a complete solution, an indexing service would be needed
 */
const getAddressBalanceHistory = async (address, days = 30) => {
  try {
    logger.info(`Fetching balance history for ${address}`);
    
    // Get current address info
    const addressInfo = await getAddressInfo(address);
    
    // For a real implementation, you would need historical data
    // Here we'll return the current balance as the latest point
    // and estimate previous points based on transactions
    
    const history = [];
    const now = Math.floor(Date.now() / 1000);
    const daySeconds = 86400;
    
    // Start with current balance
    let currentBalance = addressInfo.balance;
    
    // Add current balance as the latest point
    history.push({
      date: new Date(now * 1000).toISOString().split('T')[0],
      balance: currentBalance
    });
    
    // Sort transactions by time (oldest first)
    const sortedTxs = [...addressInfo.transactions].sort((a, b) => a.time - b.time);
    
    // Create a map of dates to balance changes
    const dateBalanceMap = new Map();
    
    // Process each transaction to determine balance changes
    for (const tx of sortedTxs) {
      const txDate = new Date(tx.time * 1000).toISOString().split('T')[0];
      
      // Calculate the balance change for this transaction
      let balanceChange = 0;
      
      // Check outputs (vout) for receives
      for (const output of tx.vout) {
        if (output.scriptPubKey && 
            output.scriptPubKey.addresses && 
            output.scriptPubKey.addresses.includes(address)) {
          balanceChange += output.value;
        }
      }
      
      // Check inputs (vin) for sends
      for (const input of tx.vin) {
        // Skip coinbase inputs
        if (input.coinbase) continue;
        
        // Check if this input references a previous output owned by this address
        if (input.prevout && 
            input.prevout.scriptPubKey && 
            input.prevout.scriptPubKey.addresses && 
            input.prevout.scriptPubKey.addresses.includes(address)) {
          balanceChange -= input.prevout.value;
        }
      }
      
      // Update the balance change for this date
      if (dateBalanceMap.has(txDate)) {
        dateBalanceMap.set(txDate, dateBalanceMap.get(txDate) + balanceChange);
      } else {
        dateBalanceMap.set(txDate, balanceChange);
      }
    }
    
    // Generate balance history for the requested number of days
    for (let i = 1; i <= days; i++) {
      const date = new Date((now - (i * daySeconds)) * 1000).toISOString().split('T')[0];
      
      // If we have a balance change for this date, apply it
      if (dateBalanceMap.has(date)) {
        currentBalance -= dateBalanceMap.get(date);
      }
      
      // Add this date's balance to our history (at the beginning since we're going backwards)
      history.unshift({
        date,
        balance: Math.max(0, currentBalance) // Ensure balance is never negative
      });
    }
    
    return {
      address,
      history
    };
  } catch (error) {
    logger.error(`Failed to get balance history for ${address}:`, error.message);
    throw error;
  }
};

module.exports = {
  initializeNodeConnection,
  executeRpcCommand,
  getBlockchainInfo,
  getBestBlockHash,
  getBlock,
  getBlockByHeight,
  getTransaction,
  getRawTransaction,
  getLatestTransactions,
  getNetworkStats,
  getAddressInfo,
  getAddressTransactions,
  getAddressBalanceHistory
};
