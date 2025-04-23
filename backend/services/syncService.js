const logger = require('../utils/logger');
const bitcoinzService = require('./bitcoinzService');
const { getSequelize } = require('../db');
const { Op } = require('sequelize');
const { broadcastEvent } = require('./socketService');

// Import models based on database type
let Block, Transaction, Address, Statistics;

// Sync intervals
const SYNC_INTERVAL = 60000; // 1 minute
const STATS_INTERVAL = 300000; // 5 minutes
const ADDRESS_UPDATE_INTERVAL = 600000; // 10 minutes

// Sync state
let isSyncing = false;
let lastSyncedBlock = 0;
let syncIntervalId = null;
let statsIntervalId = null;
let addressIntervalId = null;

/**
 * Initialize the sync service with appropriate models
 */
const initialize = async () => {
  // Get database models
  Block = require('../models/postgres/Block');
  Transaction = require('../models/postgres/Transaction');
  Address = require('../models/postgres/Address');
  Statistics = require('../models/postgres/Statistics');
  
  // Get the last synced block height from database
  try {
    const highestBlock = await Block.findOne({
      attributes: ['height'],
      order: [['height', 'DESC']],
      limit: 1
    });
    
    if (highestBlock) {
      lastSyncedBlock = highestBlock.height;
      logger.info(`Last synced block height: ${lastSyncedBlock}`);
    } else {
      logger.info('No blocks found in database, will start sync from genesis block');
    }
  } catch (error) {
    logger.error('Error getting last synced block:', error);
  }
};

/**
 * Start all synchronization processes
 */
const startSync = () => {
  if (syncIntervalId) {
    logger.warn('Sync already running');
    return;
  }
  
  logger.info('Starting blockchain synchronization service');
  
  // Initial sync
  syncBlockchain();
  
  // Set up recurring sync tasks
  syncIntervalId = setInterval(syncBlockchain, SYNC_INTERVAL);
  statsIntervalId = setInterval(updateNetworkStats, STATS_INTERVAL);
  addressIntervalId = setInterval(updateAddressBalances, ADDRESS_UPDATE_INTERVAL);
  
  logger.info('Synchronization service started');
};

/**
 * Stop all synchronization processes
 */
const stopSync = () => {
  logger.info('Stopping synchronization service');
  
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
  
  if (statsIntervalId) {
    clearInterval(statsIntervalId);
    statsIntervalId = null;
  }
  
  if (addressIntervalId) {
    clearInterval(addressIntervalId);
    addressIntervalId = null;
  }
  
  logger.info('Synchronization service stopped');
};

/**
 * Main blockchain synchronization function
 */
const syncBlockchain = async () => {
  if (isSyncing) {
    logger.debug('Sync already in progress, skipping');
    return;
  }
  
  isSyncing = true;
  
  try {
    // Get current blockchain info
    const info = await bitcoinzService.getBlockchainInfo();
    const currentHeight = info.blocks;
    
    // Check if we need to sync
    if (lastSyncedBlock >= currentHeight) {
      logger.debug(`Already synced to current height ${currentHeight}`);
      isSyncing = false;
      return;
    }
    
    logger.info(`Syncing blocks from ${lastSyncedBlock + 1} to ${currentHeight}`);
    
    // Sync blocks in batches of 10
    const batchSize = 100; // Increased batch size for potentially faster sync
    for (let height = lastSyncedBlock + 1; height <= currentHeight; height += batchSize) {
      const endHeight = Math.min(height + batchSize - 1, currentHeight);
      
      const syncPromises = [];
      for (let h = height; h <= endHeight; h++) {
        syncPromises.push(syncBlock(h));
      }
      
      await Promise.all(syncPromises);
      
      lastSyncedBlock = endHeight;
      logger.info(`Synced to block ${lastSyncedBlock}`);
    }
    
    // Update network stats after sync
    await updateNetworkStats();
    
    logger.info('Blockchain sync completed');
  } catch (error) {
    logger.error('Error syncing blockchain:', error);
  } finally {
    isSyncing = false;
  }
};

/**
 * Synchronize a specific block and its transactions
 */
const syncBlock = async (height) => {
  const sequelize = getSequelize(); // Get Sequelize instance
  let transaction; // Define transaction variable

  try {
    // Start a database transaction
    transaction = await sequelize.transaction();

    // Get block hash for the height
    const blockHash = await bitcoinzService.executeRpcCommand('getblockhash', [height]);
    
    // Get block details with transaction data (verbosity 2)
    const block = await bitcoinzService.getBlock(blockHash, 2); // Use verbosity 2
    
    // Prepare block data for DB
    const blockData = {
      hash: block.hash,
      height: block.height,
      confirmations: block.confirmations,
      size: block.size,
      strippedsize: block.strippedsize,
      weight: block.weight,
      version: block.version,
      versionHex: block.versionHex,
      merkleroot: block.merkleroot,
      tx: block.tx.map(tx => tx.txid), // Store only txids in Block model
      time: block.time,
      mediantime: block.mediantime,
      nonce: block.nonce,
      bits: block.bits,
      difficulty: block.difficulty,
      chainwork: block.chainwork,
      previousblockhash: block.previousblockhash,
      nextblockhash: block.nextblockhash
    };
    
    // Upsert block within the transaction
    await Block.upsert(blockData, { transaction });
    
    // Sync each transaction concurrently, passing detailed tx data and the transaction object
    const txSyncPromises = block.tx.map(txData => {
      // Pass the detailed transaction data directly and the transaction object
      return syncTransaction(txData, block.hash, block.height, block.time, transaction);
    });
    
    // Wait for all transaction syncs to complete within the transaction
    await Promise.all(txSyncPromises);

    // Commit the transaction if everything succeeded
    await transaction.commit();

    // Broadcast to connected clients (consider sending less data if block object is large)
    broadcastEvent('new_block', blockData, 'blocks'); // Send processed block data
    
    return blockData; // Return processed block data
  } catch (error) {
    // Rollback the transaction in case of any error
    if (transaction) await transaction.rollback();
    logger.error(`Error syncing block at height ${height}:`, error);
    throw error; // Re-throw the error after rollback
  }
};

/**
 * Synchronize a specific transaction
 */
const syncTransaction = async (txData, blockhash, blockHeight, blockTime, transaction) => { // Added transaction param
  const txid = txData.txid; // Get txid from the passed data
  try {
    // Check if transaction already exists within the transaction
    const existingTx = await Transaction.findByPk(txid, { transaction });
    // Ensure blockhash matches if tx exists, handles reorgs where tx might be in a different block now
    if (existingTx && existingTx.blockhash === blockhash) {
      // Even if it exists, we might need to update address balances if this block confirms it differently
      // For simplicity now, we skip if found in the same block context. Revisit if needed.
      return; // Transaction already synced for this block
    }
    
    // Use the detailed transaction data passed from syncBlock
    const tx = txData;
    
    // Check if it's a coinbase transaction
    const isCoinbase = tx.vin && tx.vin.length > 0 && tx.vin[0].coinbase;
    
    // Calculate transaction values
    let valueIn = 0;
    let valueOut = 0;
    let fee = 0;
    
    // Sum output values
    if (tx.vout) {
      valueOut = tx.vout.reduce((sum, output) => sum + (output.value || 0), 0);
    }
    
    // Sum input values (for non-coinbase) using prevout data
    if (!isCoinbase && tx.vin) {
      // Use prevout data if available from getblock verbosity 2
      for (const input of tx.vin) {
        // Check if prevout details are included (should be with verbosity 2)
        if (input.prevout && input.prevout.value !== undefined) {
          const inputValue = input.prevout.value; // Use value directly
          valueIn += inputValue;
          // Add address and value info to the input object for updateAddressesFromTransaction
          // This assumes the structure from getblock verbosity 2 includes scriptPubKey and addresses in prevout
          if (input.prevout.scriptPubKey && input.prevout.scriptPubKey.addresses) {
            input.address = input.prevout.scriptPubKey.addresses[0];
            input.value = inputValue; // Add value for consistency if needed later
          }
        } else if (input.txid) {
            // Fallback or log if prevout data is missing unexpectedly
            logger.warn(`Missing prevout data for input in tx ${txid}, vin index ${input.sequence}. Cannot calculate input value accurately.`);
        }
      }
      
      // Calculate fee
      fee = valueIn - valueOut;
      // Allow for small floating point inaccuracies, treat negative fees as 0
      if (fee < 0 && Math.abs(fee) > 1e-8) {
          logger.warn(`Calculated negative fee for tx ${txid}: ${fee}. Setting fee to 0. valueIn: ${valueIn}, valueOut: ${valueOut}`);
          fee = 0;
      } else if (fee < 0) {
          fee = 0; // Set small negative fees (rounding errors) to 0
      }
    }
    
    // Store transaction in database within the transaction
    // Note: Storing the full vin/vout objects can consume significant space.
    // Consider storing only necessary fields if space becomes an issue.
    const txRecord = {
      txid: tx.txid,
      hash: tx.hash,
      version: tx.version,
      size: tx.size,
      vsize: tx.vsize,
      weight: tx.weight,
      locktime: tx.locktime,
      blockhash: blockhash, // Use the blockhash from the current block sync
      confirmations: tx.confirmations || 1, // Confirmations might not be accurate from getblock, rely on block height
      time: tx.time || blockTime, // Prefer tx time if available
      blocktime: blockTime, // Always use the block's time
      vin: tx.vin, // Store potentially large vin array
      vout: tx.vout, // Store potentially large vout array
      isCoinbase: isCoinbase,
      fee: fee,
      valueIn: valueIn,
      valueOut: valueOut,
      // valueBalance might not be present in getblock results, handle potential undefined
      valueBalance: tx.valueBalance !== undefined ? tx.valueBalance : null,
      fOverwintered: tx.fOverwintered,
      // Shielded data might not be present, handle potential undefined
      vShieldedSpend: tx.vShieldedSpend || [],
      vShieldedOutput: tx.vShieldedOutput || [],
      bindingSig: tx.bindingSig
    };
    await Transaction.upsert(txRecord, { transaction }); // Pass transaction object
    
    // Update address records for inputs and outputs within the transaction
    // Pass the modified tx object which now includes address/value in vin inputs
    await updateAddressesFromTransaction(tx, isCoinbase, valueIn, valueOut, transaction); // Pass transaction object
    
    return txRecord; // Return the data that was upserted
  } catch (error) {
    // Log the specific txid where the error occurred
    // The transaction will be rolled back in syncBlock's catch block
    logger.error(`Error syncing transaction ${txid} (within block transaction):`, error);
    throw error; // Re-throw to allow Promise.all and syncBlock to catch it
  }
};

/**
 * Update address records from transaction inputs and outputs
 */
const updateAddressesFromTransaction = async (tx, isCoinbase, valueIn, valueOut, transaction) => {
  try {
    const addressChanges = new Map(); // Map to store changes per address { received: X, sent: Y, txids: Set }

    // 1. Aggregate changes from the transaction
    // Process outputs (funds received)
    if (tx.vout) {
      for (const output of tx.vout) {
        if (output.scriptPubKey?.addresses?.length > 0 && output.value > 0) {
          const address = output.scriptPubKey.addresses[0];
          if (!addressChanges.has(address)) {
            addressChanges.set(address, { received: 0, sent: 0, txids: new Set() });
          }
          const change = addressChanges.get(address);
          change.received += output.value;
          change.txids.add(tx.txid);
        }
      }
    }

    // Process inputs (funds sent)
    if (!isCoinbase && tx.vin) {
      for (const input of tx.vin) {
        if (input.address && input.value > 0) {
          const address = input.address;
          if (!addressChanges.has(address)) {
            addressChanges.set(address, { received: 0, sent: 0, txids: new Set() });
          }
          const change = addressChanges.get(address);
          change.sent += input.value;
          change.txids.add(tx.txid);
        }
      }
    }

    if (addressChanges.size === 0) {
      return; // No addresses affected by this transaction
    }

    const affectedAddresses = Array.from(addressChanges.keys());

    // 2. Fetch existing address records in bulk
    const existingAddresses = await Address.findAll({
      where: { address: { [Op.in]: affectedAddresses } },
      transaction
    });

    const existingAddressMap = new Map(existingAddresses.map(addr => [addr.address, addr]));
    const addressesToCreate = [];
    const addressesToSave = [];
    const now = new Date();

    // 3. Process updates and prepare bulk create/save lists
    for (const [address, change] of addressChanges.entries()) {
      const existingData = existingAddressMap.get(address);
      const newTxidsArray = Array.from(change.txids);

      if (existingData) {
        // Update existing record instance
        existingData.totalReceived = (Number(existingData.totalReceived) || 0) + change.received;
        existingData.totalSent = (Number(existingData.totalSent) || 0) + change.sent;
        existingData.balance = existingData.totalReceived - existingData.totalSent;
        
        const currentTxids = new Set(existingData.transactions || []);
        newTxidsArray.forEach(txid => currentTxids.add(txid));
        existingData.transactions = Array.from(currentTxids);
        existingData.txCount = existingData.transactions.length;
        existingData.lastUpdated = now;
        
        addressesToSave.push(existingData);
      } else {
        // Prepare data for new record creation
        const balance = change.received - change.sent;
        addressesToCreate.push({
          address,
          balance,
          totalReceived: change.received,
          totalSent: change.sent,
          unconfirmedBalance: 0,
          txCount: newTxidsArray.length,
          transactions: newTxidsArray,
          lastUpdated: now
        });
      }
    }

    // 4. Perform bulk create for new addresses
    if (addressesToCreate.length > 0) {
      await Address.bulkCreate(addressesToCreate, { transaction });
    }

    // 5. Save updated existing addresses (individual saves within the transaction)
    if (addressesToSave.length > 0) {
      // Consider further optimization here if needed (e.g., bulk update if supported well)
      await Promise.all(addressesToSave.map(addr => addr.save({ transaction })));
    }

  } catch (error) {
    logger.error(`Error bulk updating addresses from transaction ${tx.txid} (within block transaction):`, error);
    throw error; // Re-throw error to ensure transaction rollback
  }
};

// Remove the old updateAddressData function as it's now handled within updateAddressesFromTransaction

/**
 * Update network statistics
 */
const updateNetworkStats = async () => {
  try {
    // Get various stats from the node
    const [blockchainInfo, networkInfo, miningInfo] = await Promise.all([
      bitcoinzService.getBlockchainInfo(),
      bitcoinzService.executeRpcCommand('getnetworkinfo'),
      bitcoinzService.executeRpcCommand('getmininginfo')
    ]);
    
    // Get mempool info
    const mempoolInfo = await bitcoinzService.executeRpcCommand('getmempoolinfo');
    
    // Calculate average block time (from last 100 blocks)
    const avgBlockTime = await calculateAverageBlockTime(100);
    
    // Calculate average transactions per block (from last 100 blocks)
    const avgTxPerBlock = await calculateAverageTransactionsPerBlock(100);
    
    // Store statistics in database
    await Statistics.create({
      blockHeight: blockchainInfo.blocks,
      difficulty: blockchainInfo.difficulty,
      hashrate: miningInfo.networkhashps,
      supply: 0, // Need to calculate BTCZ supply
      transactions: mempoolInfo.size, // Mempool transaction count
      avgBlockTime,
      avgTxPerBlock,
      peerCount: networkInfo.connections,
      mempool: mempoolInfo
    });
    
    // Broadcast statistics update to connected clients
    broadcastEvent('stats_update', {
      blockchainInfo,
      networkInfo,
      miningInfo,
      mempoolInfo,
      avgBlockTime,
      avgTxPerBlock
    });
    
    logger.info('Network statistics updated');
  } catch (error) {
    logger.error('Error updating network statistics:', error);
  }
};

/**
 * Calculate average block time from last n blocks
 */
const calculateAverageBlockTime = async (blockCount = 100) => {
  try {
    // Get the last n blocks
    const blocks = await Block.findAll({
      attributes: ['height', 'time'],
      order: [['height', 'DESC']],
      limit: blockCount
    });
    
    if (blocks.length < 2) {
      return 600; // Default to 10 minutes if not enough blocks
    }
    
    // Calculate average time between blocks
    let totalTime = 0;
    for (let i = 0; i < blocks.length - 1; i++) {
      const timeDiff = blocks[i].time - blocks[i + 1].time;
      totalTime += timeDiff;
    }
    
    return totalTime / (blocks.length - 1);
  } catch (error) {
    logger.error('Error calculating average block time:', error);
    return 600; // Default to 10 minutes on error
  }
};

/**
 * Calculate average transactions per block from last n blocks
 */
const calculateAverageTransactionsPerBlock = async (blockCount = 100) => {
  try {
    // Get the last n blocks
    const blocks = await Block.findAll({
      attributes: ['tx'],
      order: [['height', 'DESC']],
      limit: blockCount
    });
    
    if (blocks.length === 0) {
      return 0;
    }
    
    // Calculate average transactions per block
    let totalTx = 0;
    blocks.forEach(block => {
      totalTx += block.tx.length;
    });
    
    return totalTx / blocks.length;
  } catch (error) {
    logger.error('Error calculating average transactions per block:', error);
    return 0;
  }
};

/**
 * Update address balances for addresses with recent transactions
 */
const updateAddressBalances = async () => {
  try {
    // Get addresses that need to be updated (last updated more than 1 hour ago)
    const addresses = await Address.findAll({
      where: {
        lastUpdated: {
          [Op.lt]: new Date(Date.now() - 3600000) // 1 hour ago
        }
      },
      limit: 100
    });
    
    if (addresses.length === 0) {
      return;
    }
    
    logger.info(`Updating balances for ${addresses.length} addresses`);
    
    for (const addressData of addresses) {
      await updateAddressBalance(addressData.address);
    }
    
    logger.info('Address balance updates completed');
  } catch (error) {
    logger.error('Error updating address balances:', error);
  }
};

/**
 * Update balance for a specific address
 */
const updateAddressBalance = async (address) => {
  try {
    // Calculate balance from transactions
    const received = await calculateAddressReceived(address);
    const sent = await calculateAddressSent(address);
    const balance = received - sent;
    
    // Update address record
    await Address.update({
      balance,
      totalReceived: received,
      totalSent: sent,
      lastUpdated: new Date()
    }, {
      where: { address }
    });
    
    return { address, balance, totalReceived: received, totalSent: sent };
  } catch (error) {
    logger.error(`Error updating balance for address ${address}:`, error);
    throw error;
  }
};

/**
 * Calculate total received amount for an address
 */
const calculateAddressReceived = async (address) => {
  try {
    // Find all transactions where this address received funds
    const transactions = await Transaction.findAll({
      where: {
        // Use a raw query condition since we need to check JSONB data
        [Op.or]: [
          sequelize.literal(`vout @> '[{"scriptPubKey": {"addresses": ["${address}"]}}]'::jsonb`)
        ]
      }
    });
    
    let totalReceived = 0;
    
    for (const tx of transactions) {
      if (tx.vout) {
        for (const output of tx.vout) {
          if (output.scriptPubKey && 
              output.scriptPubKey.addresses && 
              output.scriptPubKey.addresses.includes(address) &&
              output.value) {
            totalReceived += output.value;
          }
        }
      }
    }
    
    return totalReceived;
  } catch (error) {
    logger.error(`Error calculating received amount for address ${address}:`, error);
    return 0;
  }
};

/**
 * Calculate total sent amount for an address
 */
const calculateAddressSent = async (address) => {
  try {
    // Find all transactions where this address sent funds
    const transactions = await Transaction.findAll({
      where: {
        // Use a raw query condition since we need to check JSONB data
        [Op.or]: [
          sequelize.literal(`vin @> '[{"address": "${address}"}]'::jsonb`)
        ]
      }
    });
    
    let totalSent = 0;
    
    for (const tx of transactions) {
      if (tx.vin) {
        for (const input of tx.vin) {
          if (input.address === address && input.value) {
            totalSent += input.value;
          }
        }
      }
    }
    
    return totalSent;
  } catch (error) {
    logger.error(`Error calculating sent amount for address ${address}:`, error);
    return 0;
  }
};

/**
 * Get the current synchronization status
 */
const getSyncStatus = async () => {
  let currentHeight = 0;
  try {
    // Ensure bitcoinzService is available before calling
    if (bitcoinzService && typeof bitcoinzService.getBlockchainInfo === 'function') {
      const info = await bitcoinzService.getBlockchainInfo();
      currentHeight = info?.blocks || 0;
    } else {
       logger.warn('bitcoinzService not available for getSyncStatus');
    }
  } catch (error) {
    logger.warn('Could not fetch current blockchain height for sync status:', error.message);
  }
  return {
    lastSyncedBlock,
    currentHeight,
    isSyncing,
  };
};

module.exports = {
  initialize,
  startSync,
  stopSync,
  syncBlockchain,
  syncBlock,
  syncTransaction,
  updateNetworkStats,
  updateAddressBalances,
  getLastSyncedBlock: () => lastSyncedBlock,
  isSyncing: () => isSyncing,
  getSyncStatus // Add the new function here
};
