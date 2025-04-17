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
    const batchSize = 10;
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
  try {
    // Get block hash for the height
    const blockHash = await bitcoinzService.executeRpcCommand('getblockhash', [height]);
    
    // Get block details
    const block = await bitcoinzService.getBlock(blockHash, 1);
    
    // Store block in database
    await Block.upsert({
      hash: block.hash,
      height: block.height,
      confirmations: block.confirmations,
      size: block.size,
      strippedsize: block.strippedsize,
      weight: block.weight,
      version: block.version,
      versionHex: block.versionHex,
      merkleroot: block.merkleroot,
      tx: block.tx,
      time: block.time,
      mediantime: block.mediantime,
      nonce: block.nonce,
      bits: block.bits,
      difficulty: block.difficulty,
      chainwork: block.chainwork,
      previousblockhash: block.previousblockhash,
      nextblockhash: block.nextblockhash
    });
    
    // Sync each transaction
    for (const txid of block.tx) {
      await syncTransaction(txid, block.hash, block.height, block.time);
    }
    
    // Broadcast to connected clients
    broadcastEvent('new_block', block, 'blocks');
    
    return block;
  } catch (error) {
    logger.error(`Error syncing block at height ${height}:`, error);
    throw error;
  }
};

/**
 * Synchronize a specific transaction
 */
const syncTransaction = async (txid, blockhash, blockHeight, blockTime) => {
  try {
    // Check if transaction already exists
    const existingTx = await Transaction.findByPk(txid);
    if (existingTx && existingTx.blockhash === blockhash) {
      return; // Transaction already synced
    }
    
    // Get transaction details
    const tx = await bitcoinzService.getRawTransaction(txid, 1);
    
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
    
    // Sum input values (for non-coinbase)
    if (!isCoinbase && tx.vin) {
      for (const input of tx.vin) {
        if (input.txid && input.vout !== undefined) {
          try {
            const prevTx = await bitcoinzService.getRawTransaction(input.txid, 1);
            if (prevTx && prevTx.vout && prevTx.vout[input.vout]) {
              const inputValue = prevTx.vout[input.vout].value || 0;
              valueIn += inputValue;
              
              // Add address and value info to the input
              if (prevTx.vout[input.vout].scriptPubKey && prevTx.vout[input.vout].scriptPubKey.addresses) {
                input.address = prevTx.vout[input.vout].scriptPubKey.addresses[0];
                input.value = inputValue;
              }
            }
          } catch (err) {
            logger.error(`Error getting previous transaction ${input.txid}:`, err);
          }
        }
      }
      
      // Calculate fee
      fee = valueIn - valueOut;
      if (fee < 0) fee = 0; // Sanity check
    }
    
    // Store transaction in database
    await Transaction.upsert({
      txid: tx.txid,
      hash: tx.hash,
      version: tx.version,
      size: tx.size,
      vsize: tx.vsize,
      weight: tx.weight,
      locktime: tx.locktime,
      blockhash: tx.blockhash || blockhash,
      confirmations: tx.confirmations || 1,
      time: tx.time || blockTime,
      blocktime: tx.blocktime || blockTime,
      vin: tx.vin,
      vout: tx.vout,
      isCoinbase: isCoinbase,
      fee: fee,
      valueIn: valueIn,
      valueOut: valueOut,
      valueBalance: tx.valueBalance,
      fOverwintered: tx.fOverwintered,
      vShieldedSpend: tx.vShieldedSpend,
      vShieldedOutput: tx.vShieldedOutput,
      bindingSig: tx.bindingSig
    });
    
    // Update address records for inputs and outputs
    await updateAddressesFromTransaction(tx, isCoinbase, valueIn, valueOut);
    
    return tx;
  } catch (error) {
    logger.error(`Error syncing transaction ${txid}:`, error);
    throw error;
  }
};

/**
 * Update address records from transaction inputs and outputs
 */
const updateAddressesFromTransaction = async (tx, isCoinbase, valueIn, valueOut) => {
  try {
    const addressMap = new Map();
    
    // Process outputs (funds received)
    if (tx.vout) {
      for (const output of tx.vout) {
        if (output.scriptPubKey && output.scriptPubKey.addresses && output.value) {
          const address = output.scriptPubKey.addresses[0];
          
          if (!addressMap.has(address)) {
            addressMap.set(address, {
              address,
              totalReceived: 0,
              totalSent: 0,
              txids: new Set()
            });
          }
          
          const addrData = addressMap.get(address);
          addrData.totalReceived += output.value;
          addrData.txids.add(tx.txid);
        }
      }
    }
    
    // Process inputs (funds sent)
    if (!isCoinbase && tx.vin) {
      for (const input of tx.vin) {
        if (input.address && input.value) {
          const address = input.address;
          
          if (!addressMap.has(address)) {
            addressMap.set(address, {
              address,
              totalReceived: 0,
              totalSent: 0,
              txids: new Set()
            });
          }
          
          const addrData = addressMap.get(address);
          addrData.totalSent += input.value;
          addrData.txids.add(tx.txid);
        }
      }
    }
    
    // Update addresses in database
    for (const [address, data] of addressMap.entries()) {
      await updateAddressData(
        address,
        data.totalReceived,
        data.totalSent,
        Array.from(data.txids)
      );
    }
  } catch (error) {
    logger.error('Error updating addresses from transaction:', error);
  }
};

/**
 * Update address data in the database
 */
const updateAddressData = async (address, received, sent, txids) => {
  try {
    // Get existing address data
    let addressData = await Address.findByPk(address);
    
    if (addressData) {
      // Update existing record
      addressData.totalReceived += received;
      addressData.totalSent += sent;
      addressData.balance = addressData.totalReceived - addressData.totalSent;
      
      // Add new transactions
      const existingTxids = new Set(addressData.transactions);
      txids.forEach(txid => existingTxids.add(txid));
      addressData.transactions = Array.from(existingTxids);
      addressData.txCount = addressData.transactions.length;
      
      // Save updates
      await addressData.save();
    } else {
      // Create new address record
      const balance = received - sent;
      addressData = await Address.create({
        address,
        balance,
        totalReceived: received,
        totalSent: sent,
        unconfirmedBalance: 0,
        txCount: txids.length,
        transactions: txids,
        lastUpdated: new Date()
      });
    }
    
    return addressData;
  } catch (error) {
    logger.error(`Error updating address ${address}:`, error);
    throw error;
  }
};

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
  isSyncing: () => isSyncing
};
