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
      
      // Process vin and vout to store only essential fields
      const processVin = (vinArray) => {
        if (!vinArray) return [];
        return vinArray.map(input => ({
          txid: input.txid,
          vout: input.vout,
          sequence: input.sequence,
          coinbase: input.coinbase,
          // Include address and value if available from prevout
          address: input.prevout?.scriptPubKey?.addresses?.[0],
          value: input.prevout?.value,
        }));
      };

      const processVout = (voutArray) => {
        if (!voutArray) return [];
        return voutArray.map(output => ({
          value: output.value,
          n: output.n,
          scriptPubKey: {
            addresses: output.scriptPubKey?.addresses || [],
          },
        }));
      };

      const processedVin = processVin(tx.vin);
      const processedVout = processVout(tx.vout);

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
          JSON.stringify(processedVin), // Use processed vin
          JSON.stringify(processedVout), // Use processed vout
          isCoinbase,
          fee,
          valueIn,
          valueOut
        ]);
      } catch (insertError) {
        // Log more details about the error
        log.error(`-----------------------------------------------------`);
        log.error(`Error inserting transaction ${tx.txid}`);
        log.error(`Error Code: ${insertError.code}`);
        log.error(`Error Message: ${insertError.message}`);
        // Log the data that was attempted to be inserted (careful with large data)
        // log.error(`Attempted Data (Vin): ${JSON.stringify(processedVin)}`);
        // log.error(`Attempted Data (Vout): ${JSON.stringify(processedVout)}`);
        log.error(`Full Error Stack: ${insertError.stack}`);
        log.error(`-----------------------------------------------------`);

        // Keep the simplified insert attempt as a fallback
        try {
          log.warn(`Attempting simplified insert for transaction ${tx.txid} after full insert failed.`);
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

// ADDED: Update address balances based on transaction
const updateAddressesFromTransaction = async (tx, isCoinbase, valueIn, valueOut) => {
  const client = await pool.connect();
  try {
    const addressesToUpdate = {};

    // Process outputs (receiving addresses)
    if (tx.vout) {
      for (const output of tx.vout) {
        if (output.scriptPubKey && output.scriptPubKey.addresses) {
          for (const address of output.scriptPubKey.addresses) {
            if (!addressesToUpdate[address]) {
              addressesToUpdate[address] = { received: 0, sent: 0 };
            }
            addressesToUpdate[address].received += output.value || 0;
          }
        }
      }
    }

    // Process inputs (sending addresses) - only if not coinbase
    if (!isCoinbase && tx.vin) {
      for (const input of tx.vin) {
        // Need to fetch the previous transaction to find the input address and value
        if (input.txid) {
          try {
            // Check if we already have the input transaction in our DB
            const prevTxResult = await client.query(
              'SELECT vout FROM transactions WHERE txid = $1',
              [input.txid]
            );
            
            let prevTxVout = null;
            if (prevTxResult.rows.length > 0 && prevTxResult.rows[0].vout) {
              // Parse the stored (potentially reduced) vout JSON
              try {
                 prevTxVout = typeof prevTxResult.rows[0].vout === 'string'
                               ? JSON.parse(prevTxResult.rows[0].vout)
                               : prevTxResult.rows[0].vout;
              } catch (parseError) {
                 log.warn(`Could not parse vout from DB for prev tx ${input.txid}: ${parseError.message}`);
                 prevTxVout = null; // Ensure it's null if parsing fails
              }
              // log.debug(`Found previous tx ${input.txid} in DB for input processing`); // Too noisy
            } else {
              // If not in DB, fetch from RPC (less efficient)
              // log.debug(`Fetching previous tx ${input.txid} from RPC for input processing`); // Too noisy
              const prevTxData = await rpcCall('getrawtransaction', [input.txid, 1]); // Verbosity 1 for decoded tx
              if (prevTxData && prevTxData.vout) {
                prevTxVout = prevTxData.vout;
              }
            }

            if (prevTxVout && input.vout !== undefined && prevTxVout[input.vout]) {
              const prevOutput = prevTxVout[input.vout];
              // Check if the necessary fields exist (addresses might be nested differently now)
              const addresses = prevOutput.scriptPubKey?.addresses;
              const value = prevOutput.value;

              if (addresses && addresses.length > 0 && value !== undefined) {
                for (const address of addresses) {
                  if (!addressesToUpdate[address]) {
                    addressesToUpdate[address] = { received: 0, sent: 0 };
                  }
                  addressesToUpdate[address].sent += value || 0;
                }
              } else {
                 log.warn(`Could not find address/value in previous output for input ${input.txid}:${input.vout}`);
              }
            } else {
              log.warn(`Could not find previous output for input ${input.txid}:${input.vout}`);
            }
          } catch (rpcError) {
            log.error(`Error fetching previous transaction ${input.txid} for input processing: ${rpcError.message}`);
          }
        }
      }
    }

    // Update addresses in the database
    for (const address in addressesToUpdate) {
      const { received, sent } = addressesToUpdate[address];
      
      try {
        // Use INSERT ... ON CONFLICT to handle new and existing addresses
        // FIXED: Ensure we handle potential floating point inaccuracies
        // FIXED: Add tx_count update
        // FIXED: Use explicit casting
        // NOTE: This assumes an 'addresses' table exists with columns:
        // address, balance, total_received, total_sent, tx_count, created_at, updated_at
        // It does NOT update a 'transactions' array column like syncService does.
        await client.query(`
          INSERT INTO addresses (address, balance, total_received, total_sent, tx_count, created_at, updated_at)
          VALUES ($1::varchar, $2::float8, $3::float8, $4::float8, 1, NOW(), NOW())
          ON CONFLICT (address) DO UPDATE SET
            balance = addresses.balance + $2::float8,
            total_received = addresses.total_received + $3::float8,
            total_sent = addresses.total_sent + $4::float8,
            tx_count = addresses.tx_count + 1,
            updated_at = NOW()
          WHERE addresses.address = $1::varchar
        `, [
          address,
          (received - sent).toFixed(8), // Calculate balance change
          received.toFixed(8),
          sent.toFixed(8),
          // Note: tx_count increment handled in the query
          // Note: created_at only set on insert
        ]);
        // log.debug(`Updated address ${address}: received ${received}, sent ${sent}`); // Too noisy
      } catch (updateError) {
        log.error(`Error updating address ${address}: ${updateError.message}`);
        // Try a simplified update if the full one fails
        await client.query(`
          INSERT INTO addresses (address, created_at, updated_at)
          VALUES ($1::varchar, NOW(), NOW())
          ON CONFLICT (address) DO UPDATE SET
            updated_at = NOW()
          WHERE addresses.address = $1::varchar
        `, [address]);
      }
      
      // REMOVED: Logic attempting to store transaction history per address in 'address_transactions'
      // This table does not exist in the models and this logic is redundant.
      /*
      try {
        // Check if address_transactions table exists
        const tableCheck = await client.query(`...`);
        if (tableCheck.rows[0].exists) {
          await client.query(`... INSERT INTO address_transactions ...`);
          log.debug(`Added transaction ${tx.txid} to history for address ${address}`);
        } else {
          log.warn('address_transactions table not found, skipping history update.');
        }
      } catch (historyError) {
        log.error(`Error updating transaction history for address ${address}, tx ${tx.txid}: ${historyError.message}`);
      }
      */
    }
  } finally {
    client.release(); // Ensure client is released even if errors occur within the loop
  }
  // Removed outer try/catch as errors within the loop are handled,
  // and releasing the client is the main goal of the finally block.
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
    
    // Reduced log level for successful block processing
    // log.debug(`Processed block ${height} (hash: ${hash.substring(0, 10)}...)`);
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
    const overallStartTime = Date.now();
    let totalBlocksProcessedInRun = 0; // Track blocks processed in this run
    let totalBatchesProcessed = 0;
    let currentHeight = startHeight;
    const PROGRESS_LOG_INTERVAL = 10; // Log progress every 10 batches

    // Sync blocks in batches
    while (currentHeight <= chainHeight) {
      // Prepare batch heights
      const heightsToProcess = [];
      const endHeightForBatch = Math.min(currentHeight + BATCH_SIZE - 1, chainHeight);
      for (let h = currentHeight; h <= endHeightForBatch; h++) {
        heightsToProcess.push(h);
      }

      if (heightsToProcess.length === 0) {
        log.info('No blocks left to process in this iteration.');
        break;
      }

      // Process the batch concurrently
      const batchResults = await processBatch(heightsToProcess, chainHeight);

      // Count successes and update total processed in this run
      const successfulBlocksInBatch = batchResults.filter(r => r.status === 'success' || r.status === 'exists').length; // Count existing as processed ok
      totalBlocksProcessedInRun += successfulBlocksInBatch;
      totalBatchesProcessed++;

      // Update currentHeight for the next iteration
      const actualLastProcessed = heightsToProcess[heightsToProcess.length - 1];
      currentHeight = actualLastProcessed + 1;

      // Log progress periodically
      if (totalBatchesProcessed % PROGRESS_LOG_INTERVAL === 0 || successfulBlocksInBatch < heightsToProcess.length || currentHeight > chainHeight) { // Log every N batches, if errors occurred, or on the last batch
          const batchEndTime = Date.now();
          const overallElapsedTime = (batchEndTime - overallStartTime) / 1000; // seconds
          // Calculate speed based on blocks processed *in this run*
          const blocksPerSecond = overallElapsedTime > 0 ? totalBlocksProcessedInRun / overallElapsedTime : 0;
          const remainingBlocksOnChain = chainHeight - actualLastProcessed;
          const estimatedTimeLeftSeconds = blocksPerSecond > 0 ? remainingBlocksOnChain / blocksPerSecond : Infinity;

          let eta = 'Calculating...';
          if (estimatedTimeLeftSeconds === Infinity && blocksPerSecond > 0) {
             eta = 'Almost done!'; // Handle case where remaining is 0 but speed is calculated
          } else if (estimatedTimeLeftSeconds !== Infinity && estimatedTimeLeftSeconds > 0) {
              const hours = Math.floor(estimatedTimeLeftSeconds / 3600);
              const minutes = Math.floor((estimatedTimeLeftSeconds % 3600) / 60);
              const seconds = Math.floor(estimatedTimeLeftSeconds % 60);
              eta = `${hours}h ${minutes}m ${seconds}s`;
          } else if (blocksPerSecond === 0 && overallElapsedTime > 10) { // Avoid 'Calculating...' if stuck early
              eta = ' stalled';
          }


          const errorsInBatch = batchResults.filter(r => r.status === 'error').length;
          const existsInBatch = batchResults.filter(r => r.status === 'exists').length;
          const newInBatch = batchResults.filter(r => r.status === 'success').length;

          log.info(`Progress: ${actualLastProcessed}/${chainHeight} (${((actualLastProcessed) / chainHeight * 100).toFixed(2)}%) | Batch: ${newInBatch} new, ${existsInBatch} exists, ${errorsInBatch} errors | Speed: ${blocksPerSecond.toFixed(2)} blocks/s | ETA: ${eta}`);
      }

      // Update UI status (use the last successfully processed height in the batch)
      updateSyncStatus(actualLastProcessed, chainHeight);

      // Optional delay
      // await new Promise(resolve => setTimeout(resolve, 50));
    }

    log.info(`Sync finished! Processed approx ${totalBlocksProcessedInRun} blocks in this run.`);

    // Final UI update
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
