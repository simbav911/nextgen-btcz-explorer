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
      logger.error(`RPC Error from ${method}: ${JSON.stringify(response.data.error)}`);
      throw new Error(`RPC Error: ${response.data.error.message || JSON.stringify(response.data.error)}`);
    }

    // Debug log the response for certain commands to help with troubleshooting
    if (['getaddressbalance', 'getaddresstxids', 'getaddressutxos'].includes(method)) {
      logger.debug(`RPC ${method} response: ${JSON.stringify(response.data.result)}`);
    }

    return response.data.result;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      logger.error(`RPC command '${method}' timed out after ${timeout}ms`);
      throw new Error(`RPC command timed out: ${method}`);
    }
    
    logger.error(`RPC command '${method}' failed:`, error.message);
    if (error.response) {
      logger.error(`Response status: ${error.response.status}, data: ${JSON.stringify(error.response.data || {})}`);
    }
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
    
    // Try to get the real balance from getaddressbalance RPC
    let addressBalanceResult;
    try {
      addressBalanceResult = await executeRpcCommand('getaddressbalance', [{"addresses": [address]}]);
      if (addressBalanceResult && 'balance' in addressBalanceResult && 'received' in addressBalanceResult) {
        // Convert satoshis to BTCZ (divide by 10^8)
        balance = parseFloat(addressBalanceResult.balance) / 100000000;
        totalReceived = parseFloat(addressBalanceResult.received) / 100000000;
        totalSent = totalReceived - balance;
        
        logger.info(`Got balance from getaddressbalance for ${address}: ${balance} BTCZ, received: ${totalReceived} BTCZ, sent: ${totalSent} BTCZ`);
      } else {
        logger.warn(`Invalid getaddressbalance response for ${address}: ${JSON.stringify(addressBalanceResult)}`);
        // If RPC returned invalid data, calculate from transactions
        transactions.sort((a, b) => a.time - b.time);
        balance = 0;
        totalReceived = 0;
        totalSent = 0;
      }
    } catch (balanceError) {
      logger.error(`Error getting address balance via RPC for ${address}: ${balanceError.message}`);
      // If RPC failed, calculate from transactions
      transactions.sort((a, b) => a.time - b.time);
      balance = 0;
      totalReceived = 0;
      totalSent = 0;
    }
    
    // Calculate accurate value for each transaction (for display purposes)
    for (const tx of transactions) {
      // Initialize the value for this transaction
      tx.value = 0;
      
      // Add all outputs sent to this address
      for (const output of tx.vout) {
        if (output.scriptPubKey && 
            output.scriptPubKey.addresses && 
            output.scriptPubKey.addresses.includes(address)) {
          const outputValue = parseFloat(output.value || 0);
          tx.value += outputValue;
          
          // If we're calculating balances from transactions, add to totals
          if (addressBalanceResult === undefined) {
            totalReceived += outputValue;
          }
        }
      }
      
      // Subtract all inputs spent from this address
      let isSpending = false;
      for (const input of tx.vin) {
        if (input.coinbase) continue;
        
        // Try multiple ways to check if input is from this address
        if (input.address === address) {
          isSpending = true;
          const inputValue = parseFloat(input.value || 0);
          tx.value -= inputValue;
          
          // If we're calculating balances from transactions, add to totals
          if (addressBalanceResult === undefined) {
            totalSent += inputValue;
          }
        }
        // Also check prevout for address match
        else if (input.prevout && 
                 input.prevout.scriptPubKey && 
                 input.prevout.scriptPubKey.addresses && 
                 input.prevout.scriptPubKey.addresses.includes(address)) {
          isSpending = true;
          const inputValue = parseFloat(input.prevout.value || 0);
          tx.value -= inputValue;
          
          // If we're calculating balances from transactions, add to totals
          if (addressBalanceResult === undefined) {
            totalSent += inputValue;
          }
        }
      }
      
      // Set transaction direction flag to help frontend display
      tx.isReceived = tx.value >= 0 && !isSpending;
      
      logger.debug(`Transaction ${tx.txid} value for ${address}: ${tx.value} BTCZ (${tx.isReceived ? 'received' : 'sent'})`);
    }
    
    // If we're calculating balances from transactions, set the final balance
    if (addressBalanceResult === undefined) {
      balance = totalReceived - totalSent;
      balance = Math.max(0, balance); // Ensure balance is not negative
      logger.info(`Calculated balance from transactions for ${address}: ${balance} BTCZ, received: ${totalReceived} BTCZ, sent: ${totalSent} BTCZ`);
    }
    
    // Make sure balance is never negative
    balance = Math.max(0, balance);
    
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
    logger.info(`Fetching transactions for address ${address} (limit: ${limit}, offset: ${offset})`);
    
    // For addresses with many transactions, we need a more efficient approach
    // First, get just the txids instead of full transaction info
    let txids = [];
    
    try {
      txids = await executeRpcCommand('getaddresstxids', [{"addresses": [address]}]);
      logger.info(`Found ${txids.length} transaction IDs for address ${address}`);
      
      // Sort txids by time (if possible) - we'll need to get timestamp data
      if (txids.length > 0) {
        // For very large sets, sorting all txids can be slow
        // Instead, we'll just get the specific page of transactions needed
        const pageStart = offset;
        const pageEnd = Math.min(offset + limit, txids.length);
        const pageTxids = txids.slice(pageStart, pageEnd);
        
        // Get full information for this page of transactions
        const pageTxs = await Promise.all(
          pageTxids.map(async (txid) => {
            try {
              const tx = await getRawTransaction(txid, 1);
              
              // Calculate transaction value for this address
              let value = 0;
              
              // Check outputs for money received
              if (tx.vout) {
                for (const output of tx.vout) {
                  if (output.scriptPubKey && 
                      output.scriptPubKey.addresses && 
                      output.scriptPubKey.addresses.includes(address)) {
                    value += parseFloat(output.value || 0);
                  }
                }
              }
              
              // Check inputs for money spent
              if (tx.vin) {
                for (const input of tx.vin) {
                  if (input.coinbase) continue;
                  
                  try {
                    const prevTx = await getRawTransaction(input.txid, 1);
                    if (prevTx && prevTx.vout && prevTx.vout[input.vout]) {
                      const prevOut = prevTx.vout[input.vout];
                      if (prevOut.scriptPubKey && 
                          prevOut.scriptPubKey.addresses && 
                          prevOut.scriptPubKey.addresses.includes(address)) {
                        value -= parseFloat(prevOut.value || 0);
                      }
                    }
                  } catch (prevTxError) {
                    logger.error(`Error fetching previous tx ${input.txid}: ${prevTxError.message}`);
                  }
                }
              }
              
              // Add the calculated value and other transaction details
              return {
                ...tx,
                value: value,
                isReceived: value >= 0
              };
            } catch (txError) {
              logger.error(`Error fetching transaction ${txid}: ${txError.message}`);
              return {
                txid,
                error: true,
                value: 0,
                time: 0,
                confirmations: 0
              };
            }
          })
        );
        
        // Sort transactions by time (newest first)
        pageTxs.sort((a, b) => (b.time || 0) - (a.time || 0));
        
        return {
          address,
          transactions: pageTxs,
          count: txids.length,
          offset
        };
      }
    } catch (txidsError) {
      logger.error(`Error getting txids for address ${address}: ${txidsError.message}`);
    }
    
    // If we couldn't get transactions directly, fall back to address info
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
    
    // Get all transactions for this address (not just the first page)
    const txids = await executeRpcCommand('getaddresstxids', [{"addresses": [address]}]);
    let allTransactions = [];
    
    if (txids && Array.isArray(txids) && txids.length > 0) {
      logger.info(`Found ${txids.length} transactions for address ${address}`);
      
      // Get details for each transaction
      const txPromises = txids.map(txid => 
        getRawTransaction(txid, 1).catch(err => {
          logger.error(`Failed to fetch transaction ${txid}: ${err.message}`);
          return null;
        })
      );
      
      const txResults = await Promise.all(txPromises);
      allTransactions = txResults.filter(tx => tx !== null);
      
      // Sort by time (oldest first)
      allTransactions.sort((a, b) => a.time - b.time);
    } else {
      logger.warn(`No transactions found for address ${address}`);
      return {
        address,
        history: [{
          date: new Date().toISOString().split('T')[0],
          balance: 0
        }]
      };
    }
    
    // Process all transactions to build daily balance history
    const dailyBalances = new Map();
    let runningBalance = 0;
    
    for (const tx of allTransactions) {
      // Calculate the effect of this transaction on the address's balance
      let txEffect = 0;
      
      // Add outputs sent to this address
      for (const output of tx.vout) {
        if (output.scriptPubKey && 
            output.scriptPubKey.addresses && 
            output.scriptPubKey.addresses.includes(address)) {
          txEffect += parseFloat(output.value) || 0;
        }
      }
      
      // Subtract inputs from this address
      for (const input of tx.vin) {
        if (input.coinbase) continue;
        
        // Check if the input is from this address
        if (input.address === address) {
          txEffect -= parseFloat(input.value) || 0;
        }
        // Also check prevout for address match
        else if (input.prevout && 
                input.prevout.scriptPubKey && 
                input.prevout.scriptPubKey.addresses && 
                input.prevout.scriptPubKey.addresses.includes(address)) {
          txEffect -= parseFloat(input.prevout.value) || 0;
        }
      }
      
      // Update running balance
      runningBalance += txEffect;
      
      // Store the balance for this day
      const txDate = new Date(tx.time * 1000).toISOString().split('T')[0];
      dailyBalances.set(txDate, runningBalance);
    }
    
    // Create a history array for the requested number of days
    const now = new Date();
    const history = [];
    
    // Fill in the history with known balances or the last known balance
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      let balance = 0;
      // Find the last known balance on or before this date
      const relevantDates = Array.from(dailyBalances.keys())
        .filter(d => d <= dateStr)
        .sort((a, b) => b.localeCompare(a)); // Latest date first
      
      if (relevantDates.length > 0) {
        balance = dailyBalances.get(relevantDates[0]);
      } else {
        // If no transaction before this date, balance is 0
        balance = 0;
      }
      
      history.push({
        date: dateStr,
        balance: Math.max(0, balance)
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
