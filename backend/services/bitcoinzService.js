const axios = require('axios');
const http = require('http');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const fs = require('fs');
const path = require('path');
const os = require('os');

let rpcClient = null;

// Reuse TCP connections to bitcoinzd instead of opening one per RPC call
const rpcHttpAgent = new http.Agent({ keepAlive: true, maxSockets: 16 });

// Global cap on concurrent RPC calls. bitcoinzd has a small RPC work queue
// (shared with lightwalletd); unbounded Promise.all fan-outs caused
// "Work queue depth exceeded" errors and huge memory spikes.
const RPC_MAX_CONCURRENCY = parseInt(process.env.RPC_MAX_CONCURRENCY, 10) || 8;
let rpcActive = 0;
const rpcWaiters = [];
const acquireRpcSlot = () => {
  if (rpcActive < RPC_MAX_CONCURRENCY) {
    rpcActive++;
    return Promise.resolve();
  }
  return new Promise(resolve => rpcWaiters.push(resolve));
};
const releaseRpcSlot = () => {
  const next = rpcWaiters.shift();
  if (next) {
    next(); // hand the slot over directly
  } else {
    rpcActive--;
  }
};

const isDebugEnabled = () => typeof logger.isDebugEnabled === 'function' ? logger.isDebugEnabled() : false;

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

// Reindex progress is refreshed lazily from getNetworkStats() while the node
// is reindexing (it used to synchronously read debug.log every 10s forever).

/**
 * Initialize the BitcoinZ node connection
 */
const initializeNodeConnection = async () => {
  const rpcOptions = {
    host: process.env.BITCOINZ_RPC_HOST || '127.0.0.1',
    port: process.env.BITCOINZ_RPC_PORT || 1978,
    user: process.env.BITCOINZ_RPC_USER || '2a629aa93a1847',
    pass: process.env.BITCOINZ_RPC_PASS || 'ca3bd775e7722cf2a9babab65d4ad',
    protocol: 'http'
  };

  const maxRetries = 1000; // Keep trying for a longer time
  let retryCount = 0;
  let lastLogTime = 0;
  const logInterval = 10000; // Log every 10 seconds
  
  while (retryCount < maxRetries) {
    try {
      const now = Date.now();
      if (now - lastLogTime >= logInterval) {
        logger.info(`Waiting for BitcoinZ node at ${rpcOptions.protocol}://${rpcOptions.host}:${rpcOptions.port}...`);
        lastLogTime = now;
      }
      
      rpcClient = {
        url: `${rpcOptions.protocol}://${rpcOptions.host}:${rpcOptions.port}`,
        auth: {
          username: rpcOptions.user,
          password: rpcOptions.pass
        }
      };

      const info = await getBlockchainInfo();
      logger.info(`Successfully connected to BitcoinZ node. Version: ${info.version}, Blocks: ${info.blocks}`);
      return info;
    } catch (error) {
      retryCount++;
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds between retries
    }
  }
  logger.error('Failed to connect to BitcoinZ node after maximum retries');
  throw new Error('Failed to connect to BitcoinZ node');
};

/**
 * Execute an RPC command to the BitcoinZ node
 */
const executeRpcCommand = async (method, params = [], timeout = 30000) => {
  if (!rpcClient) {
    throw new Error('BitcoinZ node not initialized');
  }

  const maxRetries = 3;
  let retryCount = 0;
  let lastLogTime = 0;
  const logInterval = 5000; // Log every 5 seconds

  while (retryCount <= maxRetries) {
    try {
      const now = Date.now();
      if (retryCount > 0 && now - lastLogTime >= logInterval) {
        logger.info(`Waiting for RPC command '${method}' response...`);
        lastLogTime = now;
      }

      let response;
      await acquireRpcSlot();
      try {
        response = await axios.post(rpcClient.url, {
          jsonrpc: '1.0',
          id: 'bitcoinz-explorer',
          method: method,
          params: params
        }, {
          auth: rpcClient.auth,
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: timeout,
          httpAgent: rpcHttpAgent,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        });
      } finally {
        releaseRpcSlot();
      }

      if (response.data.error) {
        logger.error(`RPC Error from ${method}: ${JSON.stringify(response.data.error)}`);
        throw new Error(`RPC Error: ${response.data.error.message || JSON.stringify(response.data.error)}`);
      }

      // Debug log the response for certain commands to help with troubleshooting
      // (only stringify when debug logging is actually enabled: getaddresstxids
      // results can be tens of MB)
      if (isDebugEnabled() && ['getaddressbalance', 'getaddresstxids', 'getaddressutxos'].includes(method)) {
        logger.debug(`RPC ${method} response: ${JSON.stringify(response.data.result)}`);
      }

      return response.data.result;
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED' || error.code === 'ECONNRESET') {
        if (retryCount < maxRetries) {
          logger.info(`Connection failed for '${method}', will retry...`);
          retryCount++;
          continue;
        }
      }
      
      logger.error(`RPC command '${method}' failed after ${retryCount + 1} attempts:`, error.message);
      if (error.response) {
        logger.error(`Response status: ${error.response.status}, data: ${JSON.stringify(error.response.data || {})}`);
      }
      throw error;
    }
  }
};

/**
 * Get blockchain info (cached 5s)
 */
const getBlockchainInfo = async () => {
  return cache.wrap('blockchaininfo', 5000, () => executeRpcCommand('getblockchaininfo'));
};

/**
 * Get the latest block hash (cached 1s; polled by several timers)
 */
const getBestBlockHash = async () => {
  return cache.wrap('bestblockhash', 1000, () => executeRpcCommand('getbestblockhash'));
};

/**
 * Get block by hash
 */
const getBlock = async (hash, verbosity = 1) => {
  try {
    logger.debug(`Getting block with hash ${hash} (verbosity ${verbosity})`);

    // Handle invalid or non-hex hash format
    if (!hash || typeof hash !== 'string' || !/^[0-9a-fA-F]+$/.test(hash)) {
      logger.error(`Invalid block hash format: ${hash}`);
      throw new Error(`Invalid block hash format: ${hash}`);
    }

    // Cache blocks for 60s (immutable once confirmed); concurrent requests
    // for the same block share one RPC call
    const cacheKey = `block:${hash}:${verbosity}`;
    return await cache.wrap(cacheKey, 60000, async () => {
      // Add timeout to get better error messages
      const result = await executeRpcCommand('getblock', [hash, verbosity], 15000);

      if (verbosity >= 1) {
        // Log some basic block information
        logger.debug(`Block ${hash.substring(0, 8)}... retrieved: height=${result.height}, txs=${result.tx.length}, size=${result.size}`);
      }
      return result;
    });
  } catch (error) {
    // Improve error reporting
    if (error.message && error.message.includes('Block not found')) {
      logger.error(`Block not found: ${hash}. This may indicate a pruned node or an invalid hash.`);
    } else {
      logger.error(`Error getting block ${hash}: ${error.message}`);
    }
    
    throw error;
  }
};

/**
 * Get block by height
 */
const getBlockByHeight = async (height, verbosity = 1) => {
  try {
    // Validate height parameter
    if (!Number.isInteger(height) || height < 0) {
      logger.error(`Invalid block height: ${height}`);
      throw new Error(`Invalid block height: ${height}`);
    }
    
    logger.debug(`Getting block at height ${height} (verbosity ${verbosity})`);
    const hash = await executeRpcCommand('getblockhash', [height]);
    
    if (!hash) {
      logger.error(`No hash returned for block height ${height}`);
      throw new Error(`No hash returned for block height ${height}`);
    }
    
    logger.debug(`Block hash for height ${height}: ${hash}`);
    
    if (verbosity === 0) {
      // If verbosity is 0, we're only requesting the hash, so return it directly
      return hash;
    } else {
      // Otherwise get the full block
      return getBlock(hash, verbosity);
    }
  } catch (error) {
    // Improve error reporting
    if (error.message && error.message.includes('Block height out of range')) {
      logger.error(`Block height ${height} is out of range. The blockchain may not have reached this height yet.`);
    } else if (error.message && error.message.includes('Block not found')) {
      logger.error(`Block at height ${height} not found. This may indicate a pruned node.`);
    } else {
      logger.error(`Failed to get block at height ${height}: ${error.message}`);
    }
    
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
/**
 * Plain getrawtransaction (verbose, no input resolution), cached 60s and
 * de-duplicated. Used for previous-output lookups.
 */
const getRawTransactionPlain = async (txid) => {
  return cache.wrap(`rawtxp:${txid}`, 60000, () => executeRpcCommand('getrawtransaction', [txid, 1]));
};

const getRawTransaction = async (txid, verbose = 1) => {
  // Cache raw transactions for 60s (immutable once confirmed); concurrent
  // requests for the same txid share one lookup.
  return cache.wrap(`rawtx:${txid}:${verbose}`, 60000, () => loadRawTransaction(txid, verbose));
};

const loadRawTransaction = async (txid, verbose = 1) => {
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
        // Resolve all previous outputs in parallel (fixes N+1 sequential RPC calls)
        const inputsToResolve = transaction.vin.filter(
          input => !input.coinbase && input.txid && input.vout !== undefined && (!input.address || input.value === undefined)
        );

        if (inputsToResolve.length > 0) {
          // Deduplicate txids to avoid redundant RPC calls
          const uniqueTxids = [...new Set(inputsToResolve.map(i => i.txid))];
          const prevTxMap = new Map();

          const prevTxResults = await Promise.all(
            uniqueTxids.map(prevTxid =>
              getRawTransactionPlain(prevTxid)
                .then(tx => ({ txid: prevTxid, tx }))
                .catch(err => {
                  logger.error(`Failed to fetch previous transaction ${prevTxid}: ${err.message}`);
                  return { txid: prevTxid, tx: null };
                })
            )
          );

          for (const { txid: prevTxid, tx } of prevTxResults) {
            if (tx) prevTxMap.set(prevTxid, tx);
          }

          for (const input of inputsToResolve) {
            const prevTx = prevTxMap.get(input.txid);
            if (prevTx && prevTx.vout && prevTx.vout[input.vout]) {
              const prevOutput = prevTx.vout[input.vout];

              if (prevOutput.scriptPubKey && prevOutput.scriptPubKey.addresses && prevOutput.scriptPubKey.addresses.length > 0) {
                input.address = prevOutput.scriptPubKey.addresses[0];
              }

              if (prevOutput.value !== undefined) {
                input.value = prevOutput.value;
              }
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
        getRawTransaction(txid, 1)
          .then(tx => {
            // Ensure confirmations field is properly set
            // For mempool transactions or those without confirmations, set to 0
            if (tx.confirmations === undefined || tx.confirmations === null) {
              tx.confirmations = 0;
            }
            return tx;
          })
          .catch(err => {
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
    
    logger.debug(`Retrieved ${transactions.length} transactions from ${blocksChecked + 1} blocks`);
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
  return cache.wrap('networkstats', 30000, loadNetworkStats);
};

const loadNetworkStats = async () => {
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
    
    return { blockchainInfo, networkInfo, miningInfo };
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
      
      // If getaddresstxids fails, fire-and-forget importaddress for future lookups
      if (txIds.size === 0) {
        setImmediate(() => {
          executeRpcCommand('importaddress', [address, '', false])
            .then(() => logger.debug(`Successfully imported address ${address}`))
            .catch(err => logger.error(`Error importing address ${address}: ${err.message}`));
        });
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

// ---------------------------------------------------------------------------
// Address txid list (shared by /addresses/:address, /balance, /transactions)
// ---------------------------------------------------------------------------

// getaddresstxids for busy addresses returns 100k-300k txids (8-20 MB JSON).
// A single address page used to call it up to 4 times. Results are shared
// for a short time, de-duplicated, and kept within a total-size budget.
const ADDRESS_TXIDS_TTL_MS = 30000;
const ADDRESS_TXIDS_BUDGET = 600000; // max txids held across all cached addresses
const addressTxidsCache = new Map(); // address -> { txids, expires }
const addressTxidsInflight = new Map();

const pruneAddressTxidsCache = () => {
  const now = Date.now();
  let total = 0;
  for (const [addr, e] of addressTxidsCache) {
    if (now > e.expires) addressTxidsCache.delete(addr);
    else total += e.txids.length;
  }
  for (const [addr, e] of addressTxidsCache) {
    if (total <= ADDRESS_TXIDS_BUDGET) break;
    total -= e.txids.length;
    addressTxidsCache.delete(addr);
  }
};

/**
 * getaddresstxids for one address (oldest first, as returned by the node).
 * The returned array is shared: callers must not mutate it.
 */
const getAddressTxids = async (address, timeout = 60000) => {
  const hit = addressTxidsCache.get(address);
  if (hit && Date.now() <= hit.expires) return hit.txids;
  if (addressTxidsInflight.has(address)) return addressTxidsInflight.get(address);

  const p = executeRpcCommand('getaddresstxids', [{ addresses: [address] }], timeout)
    .then((txids) => {
      if (Array.isArray(txids) && txids.length <= ADDRESS_TXIDS_BUDGET) {
        addressTxidsCache.set(address, { txids, expires: Date.now() + ADDRESS_TXIDS_TTL_MS });
        pruneAddressTxidsCache();
      }
      return txids;
    })
    .finally(() => addressTxidsInflight.delete(address));
  addressTxidsInflight.set(address, p);
  return p;
};

setInterval(pruneAddressTxidsCache, 60000).unref();

// ---------------------------------------------------------------------------
// Address balance history
// ---------------------------------------------------------------------------

const MAX_HISTORY_DAYS = 3660;
const HISTORY_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Map block heights to block times: DB first (blocks table), RPC for misses.
 */
const getBlockTimesForHeights = async (heights) => {
  const times = new Map();
  try {
    const { getSequelize } = require('../db');
    const db = getSequelize();
    if (db && heights.length > 0) {
      const [rows] = await db.query(
        'SELECT height, time FROM blocks WHERE height = ANY($1::int[])',
        { bind: [heights] }
      );
      for (const r of rows) times.set(r.height, r.time);
    }
  } catch (e) {
    logger.warn(`Block time lookup from DB failed: ${e.message}`);
  }
  const missing = heights.filter(h => !times.has(h));
  for (const h of missing) {
    try {
      const hash = await executeRpcCommand('getblockhash', [h]);
      const header = await executeRpcCommand('getblockheader', [hash]);
      times.set(h, header.time);
    } catch (e) {
      logger.warn(`Could not get time for block ${h}: ${e.message}`);
    }
  }
  return times;
};

/**
 * Per-transaction balance effects ({ time, effect }) from the address index
 * (one getaddressdeltas call instead of one getrawtransaction per tx plus one
 * per input).
 */
const getAddressEffectsFromDeltas = async (address) => {
  const deltas = await executeRpcCommand('getaddressdeltas', [{ addresses: [address] }], 120000);
  if (!Array.isArray(deltas)) throw new Error('Invalid getaddressdeltas response');

  // Sum satoshis per transaction
  const perTx = new Map(); // txid -> { height, sats }
  for (const d of deltas) {
    const e = perTx.get(d.txid);
    if (e) e.sats += d.satoshis;
    else perTx.set(d.txid, { height: d.height, sats: d.satoshis });
  }
  const heights = [...new Set([...perTx.values()].map(e => e.height))];
  const times = await getBlockTimesForHeights(heights);

  const effects = [];
  for (const e of perTx.values()) {
    const time = times.get(e.height);
    if (time === undefined) continue;
    effects.push({ time, height: e.height, effect: e.sats / 100000000 });
  }
  return effects;
};

/**
 * Legacy path (no address index deltas): same computation as before, but with
 * bounded concurrency and only { time, effect } kept per transaction.
 */
const getAddressEffectsFromTransactions = async (txids, address) => {
  const effects = [];
  const BATCH = RPC_MAX_CONCURRENCY;
  for (let i = 0; i < txids.length; i += BATCH) {
    const batch = txids.slice(i, i + BATCH);
    const txs = await Promise.all(batch.map(txid =>
      getRawTransaction(txid, 1).catch(err => {
        logger.error(`Failed to fetch transaction ${txid}: ${err.message}`);
        return null;
      })
    ));
    for (const tx of txs) {
      if (!tx) continue;
      let txEffect = 0;
      for (const output of tx.vout || []) {
        if (output.scriptPubKey &&
            output.scriptPubKey.addresses &&
            output.scriptPubKey.addresses.includes(address)) {
          txEffect += parseFloat(output.value) || 0;
        }
      }
      for (const input of tx.vin || []) {
        if (input.coinbase) continue;
        if (input.address === address) {
          txEffect -= parseFloat(input.value) || 0;
        } else if (input.prevout &&
                   input.prevout.scriptPubKey &&
                   input.prevout.scriptPubKey.addresses &&
                   input.prevout.scriptPubKey.addresses.includes(address)) {
          txEffect -= parseFloat(input.prevout.value) || 0;
        }
      }
      effects.push({ time: tx.time, height: tx.height || 0, effect: txEffect });
    }
  }
  return effects;
};

/**
 * Get address balance history
 */
const getAddressBalanceHistory = async (address, days = 30) => {
  days = Math.min(days, MAX_HISTORY_DAYS);
  return cache.wrap(`addrhistory:${address}:${days}`, HISTORY_CACHE_TTL_MS, () => loadAddressBalanceHistory(address, days));
};

const loadAddressBalanceHistory = async (address, days) => {
  try {
    logger.info(`Fetching balance history for ${address}`);

    let effects;
    try {
      effects = await getAddressEffectsFromDeltas(address);
    } catch (deltaError) {
      logger.warn(`getaddressdeltas failed for ${address} (${deltaError.message}), falling back to per-transaction lookups`);
      const txids = await getAddressTxids(address);
      effects = (txids && Array.isArray(txids) && txids.length > 0)
        ? await getAddressEffectsFromTransactions(txids, address)
        : [];
    }

    if (effects.length === 0) {
      logger.warn(`No transactions found for address ${address}`);
      return {
        address,
        history: [{
          date: new Date().toISOString().split('T')[0],
          balance: 0
        }]
      };
    }

    logger.info(`Found ${effects.length} transactions for address ${address}`);

    // Sort by time (oldest first)
    effects.sort((a, b) => (a.time - b.time) || (a.height - b.height));

    // Balance at the end of each (UTC) day that had activity
    const dailyBalances = new Map();
    let runningBalance = 0;
    for (const e of effects) {
      runningBalance += e.effect;
      const txDate = new Date(e.time * 1000).toISOString().split('T')[0];
      dailyBalances.set(txDate, runningBalance);
    }

    // Activity dates in ascending order, walked once alongside the output days
    const activityDates = Array.from(dailyBalances.keys()).sort();

    const now = new Date();
    const history = [];
    let idx = -1;
    let balance = 0;

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Last known balance on or before this date (0 if none)
      while (idx + 1 < activityDates.length && activityDates[idx + 1] <= dateStr) {
        idx++;
        balance = dailyBalances.get(activityDates[idx]);
      }

      history.push({
        date: dateStr,
        balance: Math.max(0, idx >= 0 ? balance : 0)
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
  getAddressBalanceHistory,
  getAddressTxids,
  getRawTransactionPlain
};
