const axios = require('axios');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const os = require('os');

let rpcClient = null;

let lastReindexProgress = {
  percentage: 52,
  processedSize: 2.88,
  totalSize: 5.50,
  blocks: 0,
  lastUpdated: Date.now()
};

const getBitcoinZDataDir = () => {
  const platform = os.platform();
  const homeDir = os.homedir();
  
  if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', 'BitcoinZ');
  } else if (platform === 'win32') {
    return path.join(process.env.APPDATA, 'BitcoinZ');
  } else {
    return path.join(homeDir, '.bitcoinz');
  }
};

const getReindexProgressFromLog = () => {
  try {
    const dataDir = getBitcoinZDataDir();
    const debugLogPath = path.join(dataDir, 'debug.log');
    
    if (!fs.existsSync(debugLogPath)) {
      logger.warn(`Debug log not found at: ${debugLogPath}`);
      return null;
    }
    
    const stats = fs.statSync(debugLogPath);
    const fileSize = stats.size;
    const readSize = Math.min(fileSize, 50 * 1024); 
    const buffer = Buffer.alloc(readSize);
    
    const fd = fs.openSync(debugLogPath, 'r');
    fs.readSync(fd, buffer, 0, readSize, fileSize - readSize);
    fs.closeSync(fd);
    
    const logContent = buffer.toString('utf8');
    
    const reindexRegex = /Reindexing blocks \| ([\d\.]+) GiB \/ ([\d\.]+) GiB \((\d+)%, (\d+) blocks\)/g;
    
    let lastMatch = null;
    let match;
    
    while ((match = reindexRegex.exec(logContent)) !== null) {
      lastMatch = match;
    }
    
    if (lastMatch) {
      const processedSize = parseFloat(lastMatch[1]);
      const totalSize = parseFloat(lastMatch[2]);
      const percentage = parseInt(lastMatch[3], 10);
      const blocks = parseInt(lastMatch[4], 10);
      
      logger.debug(`Found reindexing progress: ${percentage}% (${processedSize}/${totalSize} GiB, ${blocks} blocks)`);
      
      lastReindexProgress = {
        percentage,
        processedSize,
        totalSize,
        blocks,
        lastUpdated: Date.now()
      };
      
      return lastReindexProgress;
    }
    
    return null;
  } catch (error) {
    logger.error('Error parsing debug.log for reindexing progress:', error.message);
    return null;
  }
};

const startReindexProgressMonitor = () => {
  setInterval(() => {
    getReindexProgressFromLog();
  }, 10000);
};

startReindexProgressMonitor();

/**
 * Initialize the BitcoinZ node connection
 */
const initializeNodeConnection = async () => {
  const rpcOptions = {
    host: process.env.BITCOINZ_RPC_HOST || '127.0.0.1',
    port: process.env.BITCOINZ_RPC_PORT || 1978,
    user: process.env.BITCOINZ_RPC_USER || '2a629aa93a1847',  // Use the values from .env as fallback
    pass: process.env.BITCOINZ_RPC_PASS || 'ca3bd775e7722cf2a9babab65d4ad',
    protocol: 'http'
  };

  logger.info(`Initializing RPC connection to ${rpcOptions.protocol}://${rpcOptions.host}:${rpcOptions.port}`);
  
  rpcClient = {
    url: `${rpcOptions.protocol}://${rpcOptions.host}:${rpcOptions.port}`,
    auth: {
      username: rpcOptions.user,
      password: rpcOptions.pass
    }
  };

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
    
    if (verbose === 1 && transaction) {
      if (transaction.valueBalance !== undefined) {
        logger.debug(`Processing shielded transaction: ${txid}`);
        
        if (!transaction.vShieldedSpend) {
          transaction.vShieldedSpend = [];
        }
        
        if (!transaction.vShieldedOutput) {
          transaction.vShieldedOutput = [];
        }
        
        logger.debug(`Shielded transaction details: valueBalance=${transaction.valueBalance}, spends=${transaction.vShieldedSpend.length}, outputs=${transaction.vShieldedOutput.length}`);
      }
      
      if (transaction.vin && transaction.vin.length > 0) {
        for (const input of transaction.vin) {
          if (input.coinbase) continue;
          
          if (input.txid && input.vout !== undefined && (!input.address || input.value === undefined)) {
            try {
              const prevTx = await executeRpcCommand('getrawtransaction', [input.txid, 1]);
              if (prevTx && prevTx.vout && prevTx.vout[input.vout]) {
                const prevOutput = prevTx.vout[input.vout];
                
                if (prevOutput.scriptPubKey && prevOutput.scriptPubKey.addresses && prevOutput.scriptPubKey.addresses.length > 0) {
                  input.address = prevOutput.scriptPubKey.addresses[0];
                }
                
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
    const MAX_BLOCKS = 10; 
    
    while (transactions.length < count && blocksChecked < MAX_BLOCKS) {
      const txids = block.tx;
      logger.debug(`Block ${block.height} has ${txids.length} transactions`);
      
      const batchSize = Math.min(txids.length, count - transactions.length);
      const batchTxids = txids.slice(0, batchSize);
      
      logger.debug(`Fetching ${batchTxids.length} transactions from block ${block.height}`);
      
      const txPromises = batchTxids.map(txid => 
        getRawTransaction(txid, 1).catch(err => {
          logger.error(`Failed to fetch transaction ${txid}: ${err.message}`);
          return null;
        })
      );
      
      const results = await Promise.all(txPromises);
      const validResults = results.filter(tx => tx !== null);
      transactions = transactions.concat(validResults);
      
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
    
    if (blockchainInfo.blocks === 0 && blockchainInfo.headers > 0) {
      logger.debug(`Node appears to be reindexing: ${blockchainInfo.blocks}/${blockchainInfo.headers} blocks processed`);
      
      blockchainInfo.reindexing = true;
      
      if (Date.now() - lastReindexProgress.lastUpdated > 30000) { 
        getReindexProgressFromLog(); 
      }
      
      blockchainInfo.reindexingProgress = {
        percentage: lastReindexProgress.percentage,
        processedSize: lastReindexProgress.processedSize,
        totalSize: lastReindexProgress.totalSize,
        blocks: lastReindexProgress.blocks
      };
      
      blockchainInfo.verificationprogress = lastReindexProgress.percentage / 100;
      
      logger.debug(`Using reindexing progress: ${lastReindexProgress.percentage}%`);
    }
    
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
    
    let balance = 0;
    let totalReceived = 0;
    let totalSent = 0;
    let unconfirmedBalance = 0;
    let transactions = [];
    let txIds = new Set();
    
    try {
      const utxos = await executeRpcCommand('listunspent', [0, 9999999, [address]]);
      logger.debug(`Found ${utxos.length} UTXOs for address ${address}`);
      
      for (const utxo of utxos) {
        balance += utxo.amount;
        
        if (!txIds.has(utxo.txid)) {
          txIds.add(utxo.txid);
        }
      }
    } catch (utxoError) {
      logger.error(`Error fetching UTXOs for ${address}: ${utxoError.message}`);
    }
    
    try {
      logger.debug(`Trying z_listreceivedbyaddress for ${address}`);
      const receivedTxs = await executeRpcCommand('z_listreceivedbyaddress', [address, 0]);
      logger.debug(`Found ${receivedTxs.length} received transactions for ${address} using z_listreceivedbyaddress`);
      
      for (const tx of receivedTxs) {
        if (!txIds.has(tx.txid)) {
          txIds.add(tx.txid);
        }
        
        totalReceived += tx.amount;
      }
    } catch (zListError) {
      logger.warn(`z_listreceivedbyaddress not available or failed for ${address}: ${zListError.message}`);
    }
    
    try {
      logger.debug(`Trying listtransactions for ${address}`);
      const walletTxs = await executeRpcCommand('listtransactions', ['*', 100, 0, true]);
      let addressTxs = walletTxs.filter(tx => tx.address === address);
      logger.debug(`Found ${addressTxs.length} transactions for ${address} in wallet`);
      
      for (const tx of addressTxs) {
        if (!txIds.has(tx.txid)) {
          txIds.add(tx.txid);
        }
        
        if (tx.category === 'receive') {
          totalReceived += tx.amount;
        } else if (tx.category === 'send') {
          totalSent += Math.abs(tx.amount);
        }
        
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
    
    // Always try to get address txids directly from the blockchain
    // This ensures we get all transactions even if the address isn't in the wallet
    try {
      logger.debug(`Getting all txids for address ${address} using getaddresstxids RPC call`);
      const result = await executeRpcCommand('getaddresstxids', [{"addresses": [address]}]);
      
      if (result && Array.isArray(result) && result.length > 0) {
        logger.debug(`Found ${result.length} txids for address ${address} from getaddresstxids`);
        
        // Clear existing txids if we found transactions via getaddresstxids
        // This ensures we use the blockchain data as the source of truth
        if (txIds.size === 0 || result.length > txIds.size) {
          txIds = new Set();
          for (const txid of result) {
            txIds.add(txid);
          }
        }
      }
    } catch (txidsError) {
      logger.error(`Failed to get txids for address ${address}: ${txidsError.message}`);
      
      // If getaddresstxids fails, try importing the address first
      if (txIds.size === 0) {
        try {
          logger.debug(`No transactions found for ${address}, trying importaddress`);
          await executeRpcCommand('importaddress', [address, '', false]);
          logger.debug(`Successfully imported address ${address}`);
          
          const utxos = await executeRpcCommand('listunspent', [0, 9999999, [address]]);
          logger.debug(`After import: Found ${utxos.length} UTXOs for address ${address}`);
          
          for (const utxo of utxos) {
            balance += utxo.amount;
            
            if (!txIds.has(utxo.txid)) {
              txIds.add(utxo.txid);
            }
          }
        } catch (importError) {
          logger.error(`Error importing address ${address}: ${importError.message}`);
        }
      }
    }
    
    if (txIds.size > 0) {
      logger.debug(`Fetching ${txIds.size} transactions for address ${address}`);
      
      for (const txid of txIds) {
        try {
          const tx = await getRawTransaction(txid, 1);
          
          if (tx.vout) {
            for (const output of tx.vout) {
              if (output.scriptPubKey && 
                  output.scriptPubKey.addresses && 
                  output.scriptPubKey.addresses.includes(address)) {
                if (totalReceived === 0) {
                  totalReceived += output.value;
                }
              }
            }
          }
          
          if (tx.vin) {
            for (const input of tx.vin) {
              if (input.coinbase) continue;
              
              if (input.txid && input.vout !== undefined) {
                try {
                  const prevTx = await getRawTransaction(input.txid, 1);
                  if (prevTx && 
                      prevTx.vout && 
                      prevTx.vout[input.vout] && 
                      prevTx.vout[input.vout].scriptPubKey && 
                      prevTx.vout[input.vout].scriptPubKey.addresses && 
                      prevTx.vout[input.vout].scriptPubKey.addresses.includes(address)) {
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
    
    if (balance === 0 && transactions.length > 0) {
      logger.debug(`Calculating balance from transactions for ${address}`);
      
      transactions.sort((a, b) => a.time - b.time);
      
      let runningBalance = 0;
      
      for (const tx of transactions) {
        for (const output of tx.vout) {
          if (output.scriptPubKey && 
              output.scriptPubKey.addresses && 
              output.scriptPubKey.addresses.includes(address)) {
            runningBalance += output.value;
          }
        }
        
        for (const input of tx.vin) {
          if (input.coinbase) continue;
          
          if (input.prevout && 
              input.prevout.scriptPubKey && 
              input.prevout.scriptPubKey.addresses && 
              input.prevout.scriptPubKey.addresses.includes(address)) {
            runningBalance -= input.prevout.value;
          }
        }
      }
      
      if (runningBalance > 0) {
        balance = runningBalance;
      }
    }
    
    transactions.sort((a, b) => b.time - a.time);
    
    if (txIds.size === 0) {
      logger.debug(`No transactions found for ${address}, searching in recent blocks`);
      
      try {
        const bestBlockHash = await getBestBlockHash();
        let currentBlockHash = bestBlockHash;
        
        for (let i = 0; i < 10; i++) {
          if (!currentBlockHash) break;
          
          const block = await getBlock(currentBlockHash, 2); 
          
          for (const tx of block.tx) {
            let found = false;
            
            for (const vout of tx.vout) {
              if (vout.scriptPubKey && 
                  vout.scriptPubKey.addresses && 
                  vout.scriptPubKey.addresses.includes(address)) {
                found = true;
                txIds.add(tx.txid);
                totalReceived += vout.value;
                
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
            
            if (!found) {
              for (const vin of tx.vin) {
                if (vin.prevout && 
                    vin.prevout.scriptPubKey && 
                    vin.prevout.scriptPubKey.addresses && 
                    vin.prevout.scriptPubKey.addresses.includes(address)) {
                  txIds.add(tx.txid);
                  totalSent += vin.prevout.value;
                  
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
      transactions // Return all transactions without slicing them
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
    const addressInfo = await getAddressInfo(address);
    
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
 */
const getAddressBalanceHistory = async (address, days = 30) => {
  try {
    logger.info(`Fetching balance history for ${address}`);
    
    const addressInfo = await getAddressInfo(address);
    
    const history = [];
    const now = Math.floor(Date.now() / 1000);
    const daySeconds = 86400;
    
    let currentBalance = addressInfo.balance;
    
    history.push({
      date: new Date(now * 1000).toISOString().split('T')[0],
      balance: currentBalance
    });
    
    const sortedTxs = [...addressInfo.transactions].sort((a, b) => a.time - b.time);
    
    const dateBalanceMap = new Map();
    
    for (const tx of sortedTxs) {
      const txDate = new Date(tx.time * 1000).toISOString().split('T')[0];
      
      let balanceChange = 0;
      
      for (const output of tx.vout) {
        if (output.scriptPubKey && 
            output.scriptPubKey.addresses && 
            output.scriptPubKey.addresses.includes(address)) {
          balanceChange += output.value;
        }
      }
      
      for (const input of tx.vin) {
        if (input.coinbase) continue;
        
        if (input.prevout && 
            input.prevout.scriptPubKey && 
            input.prevout.scriptPubKey.addresses && 
            input.prevout.scriptPubKey.addresses.includes(address)) {
          balanceChange -= input.prevout.value;
        }
      }
      
      if (dateBalanceMap.has(txDate)) {
        dateBalanceMap.set(txDate, dateBalanceMap.get(txDate) + balanceChange);
      } else {
        dateBalanceMap.set(txDate, balanceChange);
      }
    }
    
    for (let i = 1; i <= days; i++) {
      const date = new Date((now - (i * daySeconds)) * 1000).toISOString().split('T')[0];
      
      if (dateBalanceMap.has(date)) {
        currentBalance -= dateBalanceMap.get(date);
      }
      
      history.unshift({
        date,
        balance: Math.max(0, currentBalance) 
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
