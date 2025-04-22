// services/indexerService.js
const logger = require('../utils/logger');
const { executeRpcCommand } = require('./bitcoinzService');
const { getSequelize } = require('../db');
const { getTransaction, getBlock, getAddress } = require('../models');

// Flag to prevent multiple indexing processes running simultaneously
let isIndexing = false;
let lastIndexedBlock = 0;

/**
 * Initialize the indexer service
 */
const initializeIndexer = async () => {
  logger.info('Initializing blockchain indexer service');
  
  // Start the indexing process
  scheduleIndexing();
  
  return true;
};

/**
 * Schedule periodic indexing
 */
const scheduleIndexing = () => {
  // Run initial indexing after a short delay
  setTimeout(runIndexingJob, 10000);
  
  // Then schedule regular updates
  setInterval(runIndexingJob, 2 * 60 * 1000); // Every 2 minutes
};

/**
 * Run the indexing job
 */
const runIndexingJob = async () => {
  if (isIndexing) {
    logger.debug('Indexing already in progress, skipping this run');
    return;
  }
  
  isIndexing = true;
  logger.info('Starting blockchain indexing job');
  
  try {
    const db = getSequelize();
    if (!db) {
      logger.warn('Database not available, skipping indexing');
      isIndexing = false;
      return;
    }
    
    // Get current blockchain height
    const blockchainInfo = await executeRpcCommand('getblockchaininfo', [], 30000);
    if (!blockchainInfo || typeof blockchainInfo.blocks !== 'number') {
      logger.error('Failed to get blockchain info');
      isIndexing = false;
      return;
    }
    
    const currentHeight = blockchainInfo.blocks;
    
    // If this is the first run, get the last indexed block from the database
    if (lastIndexedBlock === 0) {
      const BlockModel = await getBlock(db);
      const lastBlock = await BlockModel.findOne({
        order: [['height', 'DESC']]
      });
      
      if (lastBlock) {
        lastIndexedBlock = lastBlock.height;
        logger.info(`Resuming indexing from block ${lastIndexedBlock}`);
      } else {
        // Start from a reasonable point in the past if no blocks are indexed
        // For a new explorer, you might want to start much earlier
        lastIndexedBlock = Math.max(0, currentHeight - 1000);
        logger.info(`No indexed blocks found. Starting from block ${lastIndexedBlock}`);
      }
    }
    
    // Calculate how many blocks to process in this run
    // Limit the number to prevent long-running jobs
    const blocksToProcess = Math.min(50, currentHeight - lastIndexedBlock);
    
    if (blocksToProcess <= 0) {
      logger.info('Blockchain index is up to date');
      isIndexing = false;
      return;
    }
    
    logger.info(`Indexing ${blocksToProcess} blocks from ${lastIndexedBlock + 1} to ${lastIndexedBlock + blocksToProcess}`);
    
    // Process blocks in batches for better performance
    for (let i = 0; i < blocksToProcess; i++) {
      const blockHeight = lastIndexedBlock + 1 + i;
      await indexBlock(blockHeight);
    }
    
    // Update the last indexed block
    lastIndexedBlock += blocksToProcess;
    
    logger.info(`Indexing complete. Last indexed block: ${lastIndexedBlock}`);
  } catch (error) {
    logger.error('Error during blockchain indexing:', error);
  } finally {
    isIndexing = false;
  }
};

/**
 * Index a single block and its transactions
 */
const indexBlock = async (height) => {
  try {
    // Get block hash
    const blockHash = await executeRpcCommand('getblockhash', [height], 20000);
    if (!blockHash) {
      logger.warn(`Failed to get hash for block ${height}`);
      return false;
    }
    
    // Get block details
    const blockDetails = await executeRpcCommand('getblock', [blockHash, 2], 30000);
    if (!blockDetails) {
      logger.warn(`Failed to get details for block ${height} (${blockHash})`);
      return false;
    }
    
    // Save block to database
    const db = getSequelize();
    const BlockModel = await getBlock(db);
    
    await BlockModel.upsert({
      hash: blockDetails.hash,
      height: blockDetails.height,
      confirmations: blockDetails.confirmations,
      size: blockDetails.size,
      strippedsize: blockDetails.strippedsize,
      weight: blockDetails.weight,
      version: blockDetails.version,
      version_hex: blockDetails.versionHex,
      merkleroot: blockDetails.merkleroot,
      tx: blockDetails.tx.map(tx => typeof tx === 'object' ? tx.txid : tx),
      time: blockDetails.time,
      mediantime: blockDetails.mediantime,
      nonce: blockDetails.nonce,
      bits: blockDetails.bits,
      difficulty: blockDetails.difficulty,
      chainwork: blockDetails.chainwork,
      previousblockhash: blockDetails.previousblockhash,
      nextblockhash: blockDetails.nextblockhash
    });
    
    // Index transactions
    const TransactionModel = await getTransaction(db);
    const AddressModel = await getAddress(db);
    
    // Track addresses that need updating
    const addressesMap = new Map();
    
    // Process each transaction
    const txDetails = Array.isArray(blockDetails.tx) ? blockDetails.tx : [];
    for (const tx of txDetails) {
      // Skip if we don't have full transaction details
      if (typeof tx !== 'object' || !tx.txid) continue;
      
      // Prepare transaction data
      const txData = {
        txid: tx.txid,
        hash: tx.hash,
        version: tx.version,
        size: tx.size,
        vsize: tx.vsize,
        weight: tx.weight,
        locktime: tx.locktime,
        blockhash: blockDetails.hash,
        confirmations: tx.confirmations || blockDetails.confirmations,
        time: tx.time || blockDetails.time,
        blocktime: tx.blocktime || blockDetails.time,
        vin: tx.vin,
        vout: tx.vout,
        is_coinbase: tx.vin && tx.vin.length > 0 && tx.vin[0].coinbase ? true : false
      };
      
      // Save transaction
      await TransactionModel.upsert(txData);
      
      // Extract addresses from outputs
      if (tx.vout) {
        for (const vout of tx.vout) {
          if (vout.scriptPubKey && vout.scriptPubKey.addresses) {
            for (const addr of vout.scriptPubKey.addresses) {
              // Track this address and transaction
              if (!addressesMap.has(addr)) {
                addressesMap.set(addr, {
                  txids: new Set(),
                  received: 0,
                  sent: 0
                });
              }
              
              // Add to transaction set
              addressesMap.get(addr).txids.add(tx.txid);
              
              // Add to received amount
              addressesMap.get(addr).received += parseFloat(vout.value || 0);
            }
          }
        }
      }
      
      // Extract addresses from inputs
      if (tx.vin) {
        for (const vin of tx.vin) {
          // Skip coinbase transactions
          if (vin.coinbase) continue;
          
          // We need to find the previous transaction to get the addresses
          try {
            // Get from our database first
            let prevTx = await TransactionModel.findOne({
              where: { txid: vin.txid }
            });
            
            // If not in database, fetch from node
            if (!prevTx) {
              const rawPrevTx = await executeRpcCommand('getrawtransaction', [vin.txid, 1], 20000);
              if (rawPrevTx) {
                prevTx = rawPrevTx;
              }
            }
            
            // If we have the previous transaction, get the addresses from the referenced output
            if (prevTx) {
              let voutData = prevTx.vout;
              
              // Handle JSON if stored as string
              if (typeof voutData === 'string') {
                try {
                  voutData = JSON.parse(voutData);
                } catch (e) {
                  logger.warn(`Error parsing vout JSON for tx ${vin.txid}: ${e.message}`);
                  continue;
                }
              }
              
              const voutIndex = vin.vout;
              if (voutData && voutData[voutIndex]) {
                const prevOut = voutData[voutIndex];
                
                let addresses = [];
                if (prevOut.scriptPubKey && prevOut.scriptPubKey.addresses) {
                  addresses = prevOut.scriptPubKey.addresses;
                }
                
                for (const addr of addresses) {
                  // Track this address and transaction
                  if (!addressesMap.has(addr)) {
                    addressesMap.set(addr, {
                      txids: new Set(),
                      received: 0,
                      sent: 0
                    });
                  }
                  
                  // Add to transaction set
                  addressesMap.get(addr).txids.add(tx.txid);
                  
                  // Add to sent amount
                  addressesMap.get(addr).sent += parseFloat(prevOut.value || 0);
                }
              }
            }
          } catch (prevTxError) {
            logger.warn(`Error processing previous transaction ${vin.txid}: ${prevTxError.message}`);
          }
        }
      }
    }
    
    // Update address records
    for (const [addr, data] of addressesMap.entries()) {
      try {
        // Get existing address record
        let addressRecord = await AddressModel.findOne({
          where: { address: addr }
        });
        
        if (addressRecord) {
          // Update existing record
          const existingTxids = Array.isArray(addressRecord.transactions) 
            ? addressRecord.transactions 
            : [];
          
          // Combine existing and new transaction IDs
          const combinedTxids = [...new Set([...existingTxids, ...data.txids])];
          
          // Update the record
          await AddressModel.update({
            total_received: addressRecord.total_received + data.received,
            total_sent: addressRecord.total_sent + data.sent,
            balance: (addressRecord.total_received + data.received) - (addressRecord.total_sent + data.sent),
            txCount: combinedTxids.length,
            transactions: combinedTxids,
            updated_at: new Date()
          }, {
            where: { address: addr }
          });
        } else {
          // Create new address record
          const txidsArray = [...data.txids];
          
          await AddressModel.create({
            address: addr,
            balance: data.received - data.sent,
            total_received: data.received,
            total_sent: data.sent,
            unconfirmed_balance: 0,
            txCount: txidsArray.length,
            transactions: txidsArray
          });
        }
      } catch (addrError) {
        logger.error(`Error updating address ${addr}: ${addrError.message}`);
      }
    }
    
    return true;
  } catch (error) {
    logger.error(`Error indexing block ${height}: ${error.message}`);
    return false;
  }
};

module.exports = {
  initializeIndexer,
  runIndexingJob, // Export for manual triggering if needed
  getLastIndexedBlock: () => lastIndexedBlock
};
