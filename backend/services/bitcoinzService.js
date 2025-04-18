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
    // Note: Core BitcoinZ client doesn't have a direct method for this
    // This would typically use an indexing service like Electrum or a custom index
    
    // For demonstration, we'll return a mock structure
    // In real implementation, use an address indexing service
    return {
      address,
      balance: 0,
      totalReceived: 0,
      totalSent: 0,
      unconfirmedBalance: 0, 
      txCount: 0,
      transactions: []
    };
  } catch (error) {
    logger.error(`Failed to get address info for ${address}:`, error.message);
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
  getAddressInfo
};
