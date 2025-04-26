// services/indexerService.js
const logger = require('../utils/logger');
const { executeRpcCommand } = require('./bitcoinzService');
const { getSequelize } = require('../db');
const { getTransaction, getBlock, getAddress } = require('../models');

// Flag to prevent multiple indexing processes running simultaneously
let isIndexing = false;
let lastIndexedBlock = 0;

// Import the address monitor service
const addressMonitorService = require('./addressMonitorService');

/**
 * Initialize the indexer service
 */
const initializeIndexer = async () => {
  logger.info('Initializing blockchain indexer service');
  
  // Load the last indexed block from the database first
  try {
    const db = getSequelize();
    if (db) {
      const BlockModel = await getBlock(db);
      const lastBlock = await BlockModel.findOne({
        order: [['height', 'DESC']]
      });
      
      if (lastBlock) {
        lastIndexedBlock = lastBlock.height;
        logger.info(`Initializing indexer from last synced block: ${lastIndexedBlock}`);
      }
    }
  } catch (error) {
    logger.warn(`Failed to load last indexed block: ${error.message}`);
  }
  
  // Start the indexing process
  scheduleIndexing();
  
  // Start the address monitor service to maintain address balances
  addressMonitorService.startMonitoring();
  logger.info('Address balance monitor service started');
  
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
        // If no blocks found, start from block 0 (so the loop starts with block 1)
        lastIndexedBlock = 0;
        logger.info(`No indexed blocks found. Starting initial sync from block 1.`);
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
    logger.info(`[IndexBlock ${height}] Starting...`);
    // Get block hash
    logger.debug(`[IndexBlock ${height}] Getting block hash...`);
    const blockHash = await executeRpcCommand('getblockhash', [height], 20000);
    if (!blockHash) {
      logger.warn(`[IndexBlock ${height}] Failed to get block hash.`);
      return false;
    }
    logger.debug(`[IndexBlock ${height}] Got block hash: ${blockHash}`);

    // Get block details
    logger.debug(`[IndexBlock ${height}] Getting block details...`);
    const blockDetails = await executeRpcCommand('getblock', [blockHash, 2], 30000);
    if (!blockDetails) {
      logger.warn(`[IndexBlock ${height}] Failed to get details for block hash ${blockHash}`);
      return false;
    }
    logger.debug(`[IndexBlock ${height}] Got block details.`);

    // Save block to database
    logger.debug(`[IndexBlock ${height}] Saving block to DB...`);
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
    logger.debug(`[IndexBlock ${height}] Block saved.`);

    // Index transactions
    logger.debug(`[IndexBlock ${height}] Processing ${blockDetails.tx?.length || 0} transactions...`);
    const TransactionModel = await getTransaction(db);
    const AddressModel = await getAddress(db);
    
    // Track addresses that need updating
    const addressesMap = new Map();
    
    // Process each transaction
    const txDetails = Array.isArray(blockDetails.tx) ? blockDetails.tx : [];
    for (const tx of txDetails) {
      // Skip if we don't have full transaction details
      if (typeof tx !== 'object' || !tx.txid) continue;
      
      // --- Process vin/vout to store only essential fields ---
      const processVin = (vinArray) => {
        if (!vinArray || !Array.isArray(vinArray)) return [];
        return vinArray.map(input => ({
          txid: input?.txid,
          vout: input?.vout,
          sequence: input?.sequence,
          coinbase: input?.coinbase,
          // Include address and value if they exist in the original data (prevout might be nested)
          address: input?.address || input?.prevout?.scriptPubKey?.addresses?.[0],
          value: input?.value || input?.prevout?.value,
        }));
      };
      const processVout = (voutArray) => {
        if (!voutArray || !Array.isArray(voutArray)) return [];
        return voutArray.map(output => ({
          value: output?.value,
          n: output?.n,
          scriptPubKey: {
            addresses: output?.scriptPubKey?.addresses || [],
          },
        }));
      };
      const processedVin = processVin(tx.vin);
      const processedVout = processVout(tx.vout);
      // --- End vin/vout processing ---

      // Prepare transaction data with optimized vin/vout
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
        vin: processedVin, // Use processed vin
        vout: processedVout, // Use processed vout
        is_coinbase: tx.vin && tx.vin.length > 0 && tx.vin[0].coinbase ? true : false,
        // Ensure other relevant fields are included if needed (fee, valueIn, valueOut might need calculation here if not present in tx object)
        // fee: calculateFee(tx), // Example: You might need to calculate/extract these
        // value_in: calculateValueIn(tx),
        // value_out: calculateValueOut(tx),
        valueBalance: tx.valueBalance, // Keep existing fields if present
        fOverwintered: tx.fOverwintered,
        vShieldedSpend: tx.vShieldedSpend,
        vShieldedOutput: tx.vShieldedOutput,
        bindingSig: tx.bindingSig
      };

      // Save transaction with detailed error logging
      // logger.debug(`[IndexBlock ${height}] Saving tx ${tx.txid}...`); // Can be too verbose
      try {
        await TransactionModel.upsert(txData);
      } catch (error) {
          // Log more details about the error
          logger.error(`-----------------------------------------------------`);
          logger.error(`[IndexBlock ${height}] Error during TransactionModel.upsert for txid ${tx.txid}`);
          if (error.name === 'SequelizeDatabaseError' || error.original) {
            logger.error(`DB Error Code: ${error.original?.code}`);
            logger.error(`DB Error Message: ${error.original?.message || error.message}`);
            logger.error(`SQL: ${error.sql}`);
          } else {
            logger.error(`Error Message: ${error.message}`);
          }
          // logger.error(`Attempted Data: ${JSON.stringify(txData)}`); // Be cautious logging potentially large data
          logger.error(`Full Error Stack: ${error.stack}`);
          logger.error(`-----------------------------------------------------`);
          // Decide whether to continue indexing other transactions in the block or stop
          // For now, we log and continue to the next transaction in the block
          continue;
      }
      // logger.debug(`[IndexBlock ${height}] Tx ${tx.txid} saved.`);

      // Extract addresses from outputs (using original tx object for full scriptPubKey)
      // logger.debug(`[IndexBlock ${height}] Processing outputs for tx ${tx.txid}...`);
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
      // logger.debug(`[IndexBlock ${height}] Finished outputs for tx ${tx.txid}.`);

      // Extract addresses from inputs
      // logger.debug(`[IndexBlock ${height}] Processing inputs for tx ${tx.txid}...`);
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
      // logger.debug(`[IndexBlock ${height}] Finished inputs for tx ${tx.txid}.`);
    } // End transaction loop
    logger.debug(`[IndexBlock ${height}] Finished processing transactions. Updating ${addressesMap.size} addresses...`);

    // Update address records
    let addrUpdateCounter = 0;
    for (const [addr, data] of addressesMap.entries()) {
      addrUpdateCounter++;
      // logger.debug(`[IndexBlock ${height}] Updating address ${addr} (${addrUpdateCounter}/${addressesMap.size})...`);
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
          
          // Calculate new values carefully
          const newTotalReceived = Number(addressRecord.total_received || 0) + Number(data.received || 0);
          const newTotalSent = Number(addressRecord.total_sent || 0) + Number(data.sent || 0);
          const newBalance = newTotalReceived - newTotalSent;
          
          // Update the record with explicit calculation and type handling
          await AddressModel.update({
            total_received: newTotalReceived,
            total_sent: newTotalSent,
            balance: newBalance > 0 ? newBalance : 0, // Ensure no negative balances
            txCount: combinedTxids.length,
            transactions: combinedTxids,
            updated_at: new Date()
          }, {
            where: { address: addr }
          });
          
          // Log if this is one of the top addresses (by received amount)
          if (data.received > 1000 || data.sent > 1000) {
            logger.info(`Updated significant address ${addr}: Balance=${newBalance}, Received=${newTotalReceived}, Sent=${newTotalSent}`);
          }
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
      // logger.debug(`[IndexBlock ${height}] Address ${addr} updated.`);
    } // End address update loop
    logger.info(`[IndexBlock ${height}] Finished updating addresses.`);

    return true;
  } catch (error) {
    logger.error(`[IndexBlock ${height}] Error during indexing: ${error.message}`, error); // Log full error
    return false;
  }
};

module.exports = {
  initializeIndexer,
  runIndexingJob, // Export for manual triggering if needed
  getLastIndexedBlock: () => lastIndexedBlock
};
