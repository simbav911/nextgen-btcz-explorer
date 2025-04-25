#!/bin/bash

# FIXED COMPLETE SYNC - Updates both blocks AND sync progress
# This will make the UI show actual progress

cd "$(dirname "$0")"
echo "==================================================================="
echo "FIXED COMPLETE SYNC - Updates blocks AND sync progress"
echo "==================================================================="

# Install required dependencies
echo "Installing required dependencies..."
npm install --no-save pg dotenv axios

# Create the fixed complete sync script
echo "Creating fixed complete sync script..."

cat > fixed-complete-sync.js << 'EOL'
require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');

// Configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'bitcoinz_explorer',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
};

const RPC_CONFIG = {
  host: process.env.BITCOINZ_RPC_HOST || '127.0.0.1',
  port: process.env.BITCOINZ_RPC_PORT || 1978,
  user: process.env.BITCOINZ_RPC_USER || '2a629aa93a1847',
  pass: process.env.BITCOINZ_RPC_PASS || 'ca3bd775e7722cf2a9babab65d4ad'
};

// Settings - very conservative defaults
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '50');
const CONCURRENT_BLOCKS = parseInt(process.env.CONCURRENT_BLOCKS || '3');
const RETRY_DELAY = parseInt(process.env.RETRY_DELAY || '1000');
const UPDATE_UI_INTERVAL = 10; // Update UI every 10 blocks

// Create a database pool
const pool = new Pool(DB_CONFIG);

// Simple logger with timestamps
const log = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  warn: (msg) => console.log(`[WARN] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.log(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  debug: (msg) => console.log(`[DEBUG] ${new Date().toISOString()} - ${msg}`)
};

// Find Explorer's sync status tables
let syncStatusTable = null;
let syncStatusTables = ['sync_status', 'syncstatus', 'SyncStatus', 'sync_progress', 'sync_state'];

async function findSyncStatusTable() {
  const client = await pool.connect();
  try {
    log.info('Looking for Explorer sync status table...');
    
    // Try to find the table the Explorer uses to track sync status
    for (const tableName of syncStatusTables) {
      try {
        const tableCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
          )
        `, [tableName]);
        
        if (tableCheck.rows[0].exists) {
          syncStatusTable = tableName;
          log.info(`Found sync status table: ${syncStatusTable}`);
          
          // Try to understand the table structure
          const columns = await client.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = $1
          `, [syncStatusTable]);
          
          log.info(`Sync status table has ${columns.rows.length} columns:`);
          columns.rows.forEach(col => {
            log.debug(`- ${col.column_name} (${col.data_type})`);
          });
          
          break;
        }
      } catch (err) {
        // Ignore errors
      }
    }
    
    if (!syncStatusTable) {
      // Look for any other tables that might be related to sync
      const tables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name LIKE '%sync%'
        OR table_name LIKE '%progress%'
        OR table_name LIKE '%status%'
      `);
      
      if (tables.rows.length > 0) {
        log.info('Found possible sync-related tables:');
        tables.rows.forEach(table => {
          log.info(`- ${table.table_name}`);
        });
        
        // Try the first one
        if (tables.rows.length > 0) {
          syncStatusTable = tables.rows[0].table_name;
          log.info(`Using ${syncStatusTable} as sync status table`);
        }
      }
    }
    
    if (!syncStatusTable) {
      log.warn('Could not find sync status table, UI progress will not update');
    }
    
    // Also check for database tables that contain sync-related data
    const dbStateQuery = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM blocks) as block_count,
        (SELECT MAX(height) FROM blocks) as max_height
    `);
    
    if (dbStateQuery.rows.length > 0) {
      const { block_count, max_height } = dbStateQuery.rows[0];
      log.info(`Current database state: ${block_count} blocks, max height: ${max_height}`);
    }
    
    return syncStatusTable;
  } finally {
    client.release();
  }
}

// Update Explorer's sync progress
async function updateSyncStatus(currentHeight, totalHeight) {
  try {
    const client = await pool.connect();
    try {
      // First, try to update the sync_status table directly
      try {
        const syncTableExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'sync_status'
          )
        `);
        
        if (syncTableExists.rows[0].exists) {
          // Update the sync_status table
          await client.query(`
            UPDATE sync_status 
            SET last_synced_block = $1, updated_at = NOW()
            WHERE id = 'main-sync'
          `, [currentHeight]);
          
          log.info(`Updated sync_status table with block height ${currentHeight}`);
          return true;
        } else {
          log.warn('sync_status table does not exist');
        }
      } catch (syncErr) {
        log.warn(`Could not update sync_status table: ${syncErr.message}`);
      }
      
      // Try to update the explorer_progress view if it exists
      try {
        const viewExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.views 
            WHERE table_name = 'explorer_progress'
          )
        `);
        
        if (viewExists.rows[0].exists) {
          log.info(`Found explorer_progress view, but it cannot be updated directly.`);
        }
      } catch (viewErr) {
        // Ignore errors
      }
      
      // Update the statistics table with the latest block height
      try {
        // First check if statistics table has an id column
        const statsColumns = await client.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'statistics'
        `);
        
        const hasIdColumn = statsColumns.rows.some(col => col.column_name === 'id');
        
        if (hasIdColumn) {
          // Try to update existing record or insert new one
          const statsResult = await client.query(`
            INSERT INTO statistics (id, block_height, timestamp)
            VALUES (1, $1, NOW())
            ON CONFLICT (id) DO UPDATE
            SET block_height = $1, updated_at = NOW()
            RETURNING id
          `, [currentHeight]);
          
          if (statsResult.rowCount > 0) {
            log.info(`Updated statistics table with block height ${currentHeight}`);
            return true;
          }
        } else {
          // Just insert a new record
          const statsResult = await client.query(`
            INSERT INTO statistics (block_height, timestamp)
            VALUES ($1, NOW())
          `, [currentHeight]);
          
          if (statsResult.rowCount > 0) {
            log.info(`Added new statistics record with block height ${currentHeight}`);
            return true;
          }
        }
      } catch (statsErr) {
        log.warn(`Could not update statistics table: ${statsErr.message}`);
      }
      
      // Create a file to signal the main application about our progress
      try {
        const fs = require('fs');
        const progressFile = 'sync_progress.json';
        fs.writeFileSync(progressFile, JSON.stringify({
          lastSyncedBlock: currentHeight,
          totalBlocks: totalHeight,
          timestamp: new Date().toISOString()
        }));
        log.info(`Created sync progress file: ${progressFile}`);
        return true;
      } catch (fileErr) {
        log.warn(`Could not create progress file: ${fileErr.message}`);
      }
      
      return false;
    } finally {
      client.release();
    }
  } catch (err) {
    log.error(`Error updating sync status: ${err.message}`);
    return false;
  }
}

// Simple RPC call with retry
const rpcCall = async (method, params = [], retries = 3) => {
  try {
    const response = await axios.post(`http://${RPC_CONFIG.host}:${RPC_CONFIG.port}`, {
      jsonrpc: '1.0',
      id: 'bitcoinz-sync',
      method,
      params
    }, {
      auth: {
        username: RPC_CONFIG.user,
        password: RPC_CONFIG.pass
      },
      timeout: 30000 // 30 second timeout
    });
    
    if (response.data.error) {
      throw new Error(`RPC Error: ${response.data.error.message}`);
    }
    
    return response.data.result;
  } catch (error) {
    if (retries > 0) {
      log.warn(`RPC call to ${method} failed, retrying in ${RETRY_DELAY}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return rpcCall(method, params, retries - 1);
    }
    
    throw error;
  }
};

// Get blockchain info
const getBlockchainInfo = async () => {
  return rpcCall('getblockchaininfo');
};

// Get block hash for height
const getBlockHash = async (height) => {
  return rpcCall('getblockhash', [height]);
};

// Check if block exists in database
const blockExistsInDb = async (height) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT COUNT(*) FROM blocks WHERE height = $1', [height]);
    return parseInt(result.rows[0].count) > 0;
  } finally {
    client.release();
  }
};

// Get highest block in database
const getHighestBlockInDb = async () => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT MAX(height) FROM blocks');
    return result.rows[0].max ? parseInt(result.rows[0].max) : 0;
  } finally {
    client.release();
  }
};

// Get block data by hash - FIXED: Use verbosity level 2 to match main application
const getBlock = async (hash) => {
  return rpcCall('getblock', [hash, 2]); // FIXED: Changed from verbosity 1 to 2 to get full transaction details
};

// Save block (blocks only, no transactions) - FIXED: Format to match main application
const saveBlock = async (block) => {
  const client = await pool.connect();
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Check if block exists
    const existsResult = await client.query('SELECT COUNT(*) FROM blocks WHERE hash = $1', [block.hash]);
    
    if (parseInt(existsResult.rows[0].count) > 0) {
      // Update existing block
      await client.query(`
        UPDATE blocks SET 
          confirmations = $1,
          nextblockhash = $2,
          updated_at = NOW()
        WHERE hash = $3
      `, [
        block.confirmations || 0, 
        block.nextblockhash || null, 
        block.hash
      ]);
    } else {
      // FIXED: Process transaction IDs to match main application format
      const txids = block.tx.map(tx => typeof tx === 'object' ? tx.txid : tx);
      
      // Insert new block with explicit casting for each parameter
      await client.query(`
        INSERT INTO blocks (
          hash, height, confirmations, size, strippedsize, weight,
          version, version_hex, merkleroot, tx, time, mediantime,
          nonce, bits, difficulty, chainwork, previousblockhash, nextblockhash,
          created_at, updated_at
        ) VALUES (
          $1::varchar, $2::integer, $3::integer, $4::integer, 
          $5::integer, $6::integer, $7::integer, $8::varchar, 
          $9::varchar, $10::text[], $11::integer, $12::integer,
          $13::varchar, $14::varchar, $15::float8, $16::varchar,
          $17::varchar, $18::varchar, NOW(), NOW()
        )
      `, [
        block.hash,
        block.height,
        block.confirmations || 0,
        block.size || 0,
        block.strippedsize || 0,
        block.weight || 0,
        block.version || 0,
        block.versionHex || '', // FIXED: Ensure field name matches
        block.merkleroot || '',
        txids, // FIXED: Use processed txids array
        block.time || 0,
        block.mediantime || 0,
        block.nonce || '',
        block.bits || '',
        block.difficulty || 0,
        block.chainwork || '',
        block.previousblockhash || null,
        block.nextblockhash || null
      ]);
      
      // FIXED: Process transactions if they're objects (from verbosity 2)
      if (block.tx && block.tx.length > 0 && typeof block.tx[0] === 'object') {
        for (const tx of block.tx) {
          await saveTransaction(tx, block);
        }
      }
    }
    
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// ADDED: Save transaction data
const saveTransaction = async (tx, block) => {
  const client = await pool.connect();
  try {
    // Check if transaction exists
    const existsResult = await client.query('SELECT COUNT(*) FROM transactions WHERE txid = $1', [tx.txid]);
    
    if (parseInt(existsResult.rows[0].count) > 0) {
      // Update existing transaction
      await client.query(`
        UPDATE transactions SET 
          confirmations = $1,
          updated_at = NOW()
        WHERE txid = $2
      `, [
        tx.confirmations || 1, 
        tx.txid
      ]);
    } else {
      // Calculate values
      const isCoinbase = tx.vin && tx.vin.length > 0 && tx.vin[0].coinbase ? true : false;
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
          if (input.prevout && input.prevout.value !== undefined) {
            valueIn += input.prevout.value;
          }
        }
        
        // Calculate fee
        fee = valueIn - valueOut;
        if (fee < 0) fee = 0; // Handle rounding errors
      }
      
      try {
        // Insert transaction - use explicit type casting for PostgreSQL
        await client.query(`
          INSERT INTO transactions (
            txid, hash, version, size, vsize, weight, locktime,
            blockhash, confirmations, time, blocktime,
            vin, vout, is_coinbase, fee, value_in, value_out,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, 
            $8, $9, $10, $11,
            $12::jsonb, $13::jsonb, $14::boolean, $15::float8, $16::float8, $17::float8,
            NOW(), NOW()
          )
        `, [
          tx.txid,
          tx.hash,
          tx.version,
          tx.size,
          tx.vsize,
          tx.weight,
          tx.locktime,
          block.hash,
          tx.confirmations || 1,
          tx.time || block.time,
          block.time,
          JSON.stringify(tx.vin || []),
          JSON.stringify(tx.vout || []),
          isCoinbase,
          fee,
          valueIn,
          valueOut
        ]);
      } catch (insertError) {
        log.error(`Error inserting transaction ${tx.txid}: ${insertError.message}`);
        // Try a simplified insert if the full insert fails
        try {
          log.warn(`Attempting simplified insert for transaction ${tx.txid}`);
          await client.query(`
            INSERT INTO transactions (
              txid, blockhash, is_coinbase, created_at, updated_at
            ) VALUES (
              $1, $2, $3::boolean, NOW(), NOW()
            )
          `, [
            tx.txid,
            block.hash,
            isCoinbase
          ]);
          log.info(`Simplified insert succeeded for transaction ${tx.txid}`);
        } catch (simpleInsertError) {
          log.error(`Even simplified insert failed for transaction ${tx.txid}: ${simpleInsertError.message}`);
          // Just continue - we at least have the block
        }
      }
      
      // Process addresses
      await updateAddressesFromTransaction(tx, isCoinbase, valueIn, valueOut);
    }
    
    return true;
  } catch (error) {
    log.error(`Error saving transaction ${tx.txid}: ${error.message}`);
    return false;
  } finally {
    client.release();
  }
};

// ADDED: Update addresses from transaction
const updateAddressesFromTransaction = async (tx, isCoinbase, valueIn, valueOut) => {
  try {
    const addressChanges = new Map(); // Map to store changes per address { received: X, sent: Y, txids: Set }

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
        // Try to get address from prevout if available
        if (input.prevout && input.prevout.scriptPubKey && input.prevout.scriptPubKey.addresses) {
          const address = input.prevout.scriptPubKey.addresses[0];
          const value = input.prevout.value;
          
          if (address && value > 0) {
            if (!addressChanges.has(address)) {
              addressChanges.set(address, { received: 0, sent: 0, txids: new Set() });
            }
            const change = addressChanges.get(address);
            change.sent += value;
            change.txids.add(tx.txid);
          }
        }
      }
    }

    if (addressChanges.size === 0) {
      return; // No addresses affected by this transaction
    }

    const client = await pool.connect();
    try {
      // Get all affected addresses
      const affectedAddresses = Array.from(addressChanges.keys());
      
      // Find existing addresses
      const existingResult = await client.query(`
        SELECT address, balance, total_received, total_sent, tx_count, transactions
        FROM addresses
        WHERE address = ANY($1)
      `, [affectedAddresses]);
      
      const existingAddresses = new Map(existingResult.rows.map(row => [row.address, row]));
      
      // Process each address
      for (const [address, change] of addressChanges.entries()) {
        const existing = existingAddresses.get(address);
        const txidsArray = Array.from(change.txids);
        
        try {
          if (existing) {
            // Update existing address
            const totalReceived = parseFloat(existing.total_received || 0) + change.received;
            const totalSent = parseFloat(existing.total_sent || 0) + change.sent;
            const balance = totalReceived - totalSent;
            
            // Combine transaction arrays
            const currentTxids = new Set(existing.transactions || []);
            txidsArray.forEach(txid => currentTxids.add(txid));
            const newTxids = Array.from(currentTxids);
            
            await client.query(`
              UPDATE addresses SET
                balance = $1,
                total_received = $2,
                total_sent = $3,
                tx_count = $4,
                transactions = $5,
                last_updated = NOW(),
                updated_at = NOW()
              WHERE address = $6
            `, [
              balance,
              totalReceived,
              totalSent,
              newTxids.length,
              newTxids,
              address
            ]);
          } else {
            // Create new address with ON CONFLICT DO UPDATE to handle race conditions
            const balance = change.received - change.sent;
            
            await client.query(`
              INSERT INTO addresses (
                address, balance, total_received, total_sent,
                unconfirmed_balance, tx_count, transactions,
                last_updated, created_at, updated_at
              ) 
              VALUES (
                $1, $2, $3, $4, 0, $5, $6, NOW(), NOW(), NOW()
              )
              ON CONFLICT (address) DO UPDATE SET
                balance = addresses.balance + $2,
                total_received = addresses.total_received + $3,
                total_sent = addresses.total_sent + $4,
                tx_count = 
                  CASE 
                    WHEN addresses.transactions @> $6::text[] THEN addresses.tx_count
                    ELSE addresses.tx_count + array_length($6::text[], 1)
                  END,
                transactions = array_cat(addresses.transactions, $6::text[]),
                last_updated = NOW(),
                updated_at = NOW()
            `, [
              address,
              balance,
              change.received,
              change.sent,
              txidsArray.length,
              txidsArray
            ]);
          }
        } catch (addressError) {
          log.warn(`Error processing address ${address}: ${addressError.message}`);
          // Continue with other addresses
        }
      }
    } finally {
      client.release();
    }
  } catch (error) {
    log.error(`Error updating addresses for transaction ${tx.txid}: ${error.message}`);
  }
};

// Process a single block
const processBlock = async (height, chainHeight) => {
  try {
    // Check if block already exists
    if (await blockExistsInDb(height)) {
      log.debug(`Block ${height} already exists in database`);
      return { height, status: 'exists' };
    }

    // Get block hash
    const hash = await getBlockHash(height);
    if (!hash) {
      log.warn(`Could not get hash for block ${height}`);
      return { height, status: 'error', error: 'No hash returned' };
    }

    // Get block data
    const block = await getBlock(hash);
    if (!block) {
      log.warn(`Could not get data for block ${height} (hash: ${hash})`);
      return { height, status: 'error', error: 'No block data returned' };
    }

    // Save block to database
    await saveBlock(block);
    
    log.debug(`Processed block ${height} (hash: ${hash.substring(0, 10)}...)`);
    return { height, status: 'success' };
  } catch (error) {
    log.error(`Error processing block ${height}: ${error.message}`);
    return { height, status: 'error', error: error.message };
  }
};

// Process a batch of blocks concurrently
const processBatch = async (heights, chainHeight) => {
  // Create a queue of blocks to process
  const queue = [...heights];
  const results = [];
  const active = new Set();
  
  // Process blocks until queue is empty
  while (queue.length > 0 || active.size > 0) {
    // Fill up active set from queue
    while (active.size < CONCURRENT_BLOCKS && queue.length > 0) {
      const height = queue.shift();
      active.add(height);
      
      // Process this block
      processBlock(height, chainHeight)
        .then(result => {
          results.push(result);
          active.delete(height);
        })
        .catch(error => {
          log.error(`Unexpected error processing block ${height}: ${error.message}`);
          results.push({ height, status: 'error', error: error.message });
          active.delete(height);
        });
    }
    
    // Wait a bit before checking again
    if (active.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Wait for all promises to resolve
  while (results.length < heights.length) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
};

// Main sync function
const syncBlocks = async () => {
  try {
    // Find the Explorer's sync status table first
    await findSyncStatusTable();
    
    // Get blockchain info
    const info = await getBlockchainInfo();
    const chainHeight = info.blocks;
    log.info(`Connected to BitcoinZ node, chain height: ${chainHeight}`);
    
    // Get highest block in database
    const dbHeight = await getHighestBlockInDb();
    log.info(`Highest block in database: ${dbHeight}`);
    
    if (dbHeight >= chainHeight) {
      log.info('Database is already synced!');
      return;
    }
    
    // Calculate blocks to sync
    const startHeight = dbHeight + 1;
    const blocksToSync = chainHeight - startHeight + 1;
    log.info(`Need to sync ${blocksToSync} blocks (${startHeight} to ${chainHeight})`);
    
    // Initialize sync progress in Explorer UI
    updateSyncStatus(dbHeight, chainHeight);
    
    // Track statistics
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;
    let existingCount = 0;
    
    // Process blocks in batches
    for (let height = startHeight; height <= chainHeight; height += BATCH_SIZE) {
      const batchStart = height;
      const batchEnd = Math.min(height + BATCH_SIZE - 1, chainHeight);
      
      log.info(`Processing batch: blocks ${batchStart} to ${batchEnd}`);
      const batchStartTime = Date.now();
      
      // Create array of blocks to process
      const heights = [];
      for (let h = batchStart; h <= batchEnd; h++) {
        heights.push(h);
      }
      
      // Process the batch
      const results = await processBatch(heights, chainHeight);
      
      // Count results
      const batchSuccess = results.filter(r => r.status === 'success').length;
      const batchError = results.filter(r => r.status === 'error').length;
      const batchExisting = results.filter(r => r.status === 'exists').length;
      
      successCount += batchSuccess;
      errorCount += batchError;
      existingCount += batchExisting;
      
      // Calculate statistics
      const batchTime = (Date.now() - batchStartTime) / 1000;
      const blocksPerSecond = batchSuccess / Math.max(0.1, batchTime);
      const progress = ((batchEnd - startHeight + 1) / blocksToSync) * 100;
      
      // Calculate estimated time remaining
      const remainingBlocks = chainHeight - batchEnd;
      const estimatedSecondsLeft = remainingBlocks / Math.max(0.1, blocksPerSecond);
      
      // Format time remaining
      let timeRemaining;
      if (estimatedSecondsLeft < 60) {
        timeRemaining = `${Math.round(estimatedSecondsLeft)}s`;
      } else if (estimatedSecondsLeft < 3600) {
        timeRemaining = `${Math.floor(estimatedSecondsLeft / 60)}m ${Math.round(estimatedSecondsLeft % 60)}s`;
      } else {
        timeRemaining = `${Math.floor(estimatedSecondsLeft / 3600)}h ${Math.floor((estimatedSecondsLeft % 3600) / 60)}m`;
      }
      
      // Log batch statistics
      log.info(`Batch completed in ${batchTime.toFixed(1)}s: ${batchSuccess} new, ${batchExisting} existing, ${batchError} errors`);
      log.info(`Progress: ${progress.toFixed(2)}% | Speed: ${blocksPerSecond.toFixed(1)} blocks/sec`);
      log.info(`Blocks: ${batchEnd}/${chainHeight} | Estimated time remaining: ${timeRemaining}`);
      
      // Update Explorer UI with latest progress
      updateSyncStatus(batchEnd, chainHeight);
    }
    
    // Log final statistics
    const totalTime = (Date.now() - startTime) / 1000 / 60;
    log.info(`Sync completed in ${totalTime.toFixed(2)} minutes`);
    log.info(`Results: ${successCount} blocks added, ${existingCount} already existed, ${errorCount} errors`);
    
    // Final update to Explorer UI
    updateSyncStatus(chainHeight, chainHeight);
    
  } catch (error) {
    log.error(`Sync failed: ${error.message}`);
    log.error(error.stack);
  } finally {
    // Close pool
    await pool.end();
  }
};

// Run the sync
syncBlocks().catch(err => {
  log.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
EOL

echo "Fixed complete sync script created successfully!"

# Make it executable
chmod +x fixed-complete-sync.js

# Run the fixed complete sync script
echo "Starting fixed complete sync process..."
node fixed-complete-sync.js

# Check exit status
if [ $? -ne 0 ]; then
    echo "Sync encountered an error. Check the logs for details."
    exit 1
fi

echo "Sync completed successfully!"
