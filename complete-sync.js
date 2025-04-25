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

// Update Explorer's sync status
async function updateSyncStatus(currentHeight, totalHeight) {
  if (!syncStatusTable) return false;
  
  const client = await pool.connect();
  try {
    // First check what columns the table has
    const columns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = $1
    `, [syncStatusTable]);
    
    const columnNames = columns.rows.map(col => col.column_name);
    
    // Common column names for sync progress
    const progressColumns = [
      'current_block', 'currentblock', 'current_height', 'last_block', 
      'lastblock', 'last_synced_block', 'lastsyncedblock', 'height', 
      'synced_block', 'synced_height', 'processed_height'
    ];
    
    // Find a column that likely holds the current sync height
    const heightColumn = columnNames.find(col => progressColumns.includes(col.toLowerCase()));
    
    if (heightColumn) {
      // Try to update the sync status
      try {
        await client.query(`
          UPDATE ${syncStatusTable}
          SET "${heightColumn}" = $1
        `, [currentHeight]);
        
        log.debug(`Updated sync status: ${heightColumn} = ${currentHeight}`);
        return true;
      } catch (updateErr) {
        log.warn(`Failed to update sync status: ${updateErr.message}`);
      }
    } else {
      log.warn(`Could not find a suitable column in ${syncStatusTable} to update sync progress`);
    }
    
    return false;
  } catch (err) {
    log.error(`Error updating sync status: ${err.message}`);
    return false;
  } finally {
    client.release();
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
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    if (response.data.error) {
      throw new Error(`RPC Error: ${JSON.stringify(response.data.error)}`);
    }

    return response.data.result;
  } catch (error) {
    if (retries > 0) {
      log.warn(`RPC call ${method} failed, retrying in ${RETRY_DELAY}ms... (${retries} retries left)`);
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

// Get highest block in database
const getHighestBlockInDb = async () => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT MAX(height) FROM blocks');
    return result.rows[0].max || 0;
  } finally {
    client.release();
  }
};

// Check if block exists in database
const blockExistsInDb = async (height) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT COUNT(*) FROM blocks WHERE height = $1', [height]);
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    return false;
  } finally {
    client.release();
  }
};

// Get block hash by height
const getBlockHash = async (height) => {
  return rpcCall('getblockhash', [height]);
};

// Get block data by hash
const getBlock = async (hash) => {
  return rpcCall('getblock', [hash, 1]); // Using verbosity 1 to get simpler block data
};

// Save block (blocks only, no transactions)
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
        block.versionHex || '',
        block.merkleroot || '',
        block.tx, // Already an array from RPC
        block.time || 0,
        block.mediantime || 0,
        block.nonce || '',
        block.bits || '',
        block.difficulty || 0,
        block.chainwork || '',
        block.previousblockhash || null,
        block.nextblockhash || null
      ]);
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
      log.warn(`Could not get data for block ${height}`);
      return { height, status: 'error', error: 'No block data returned' };
    }

    // Save block
    await saveBlock(block);
    
    // Update UI every few blocks
    if (height % UPDATE_UI_INTERVAL === 0) {
      updateSyncStatus(height, chainHeight);
    }
    
    log.debug(`Block ${height} processed successfully (${block.tx.length} transactions)`);
    return { height, status: 'success', txCount: block.tx.length };
  } catch (error) {
    log.error(`Error processing block ${height}: ${error.message}`);
    return { height, status: 'error', error: error.message };
  }
};

// Process blocks in batch with throttling
const processBatch = async (heights, chainHeight) => {
  const results = [];
  const concurrentQueue = [];
  
  for (const height of heights) {
    // Push new block into queue
    concurrentQueue.push(processBlock(height, chainHeight));
    
    // If queue is full or this is the last block, process the queue
    if (concurrentQueue.length >= CONCURRENT_BLOCKS || height === heights[heights.length - 1]) {
      // Process all blocks in queue
      const batchResults = await Promise.all(concurrentQueue);
      results.push(...batchResults);
      
      // Clear queue
      concurrentQueue.length = 0;
      
      // Add small delay to avoid overwhelming the node
      await new Promise(resolve => setTimeout(resolve, 200));
    }
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
