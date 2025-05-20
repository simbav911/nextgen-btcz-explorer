require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Get database configuration from environment variables
const {
  DB_HOST = 'localhost',
  DB_PORT = 5432,
  DB_NAME = 'bitcoinz_explorer',
  DB_USER = 'postgres',
  DB_PASSWORD = 'postgres'
} = process.env;

// Create a database pool
const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD
});

async function createSyncStatusTable() {
  console.log('Creating sync_status table...');
  
  const client = await pool.connect();
  try {
    // Check if table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'sync_status'
      )
    `);
    
    if (tableExists.rows[0].exists) {
      console.log('sync_status table already exists');
    } else {
      // Create the table
      await client.query(`
        CREATE TABLE sync_status (
          id VARCHAR(255) PRIMARY KEY,
          last_synced_block INTEGER NOT NULL DEFAULT 0,
          is_running BOOLEAN NOT NULL DEFAULT false,
          status VARCHAR(255) NOT NULL DEFAULT 'idle',
          start_time TIMESTAMP WITH TIME ZONE,
          end_time TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('sync_status table created successfully');
    }
    
    // Get current highest block from blocks table
    const highestBlockResult = await client.query(`
      SELECT MAX(height) FROM blocks
    `);
    
    const highestBlock = highestBlockResult.rows[0].max || 0;
    console.log(`Highest block in database: ${highestBlock}`);
    
    // Check if we have a sync record
    const syncRecordExists = await client.query(`
      SELECT COUNT(*) FROM sync_status WHERE id = 'main-sync'
    `);
    
    if (parseInt(syncRecordExists.rows[0].count) > 0) {
      // Update existing record
      await client.query(`
        UPDATE sync_status 
        SET last_synced_block = $1, updated_at = NOW()
        WHERE id = 'main-sync'
      `, [highestBlock]);
      console.log('Updated existing sync status record');
    } else {
      // Create new record
      await client.query(`
        INSERT INTO sync_status 
        (id, last_synced_block, is_running, status, created_at, updated_at)
        VALUES ('main-sync', $1, false, 'idle', NOW(), NOW())
      `, [highestBlock]);
      console.log('Created new sync status record');
    }
    
    // Create a view for explorer_progress if it doesn't exist
    try {
      const viewExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.views 
          WHERE table_name = 'explorer_progress'
        )
      `);
      
      if (!viewExists.rows[0].exists) {
        await client.query(`
          CREATE VIEW explorer_progress AS
          SELECT 
            (SELECT MAX(height) FROM blocks) as current_height,
            (SELECT last_synced_block FROM sync_status WHERE id = 'main-sync') as last_synced_block,
            (SELECT is_running FROM sync_status WHERE id = 'main-sync') as is_syncing
        `);
        console.log('Created explorer_progress view');
      } else {
        console.log('explorer_progress view already exists');
      }
    } catch (viewError) {
      console.error('Error creating view:', viewError.message);
    }
    
    console.log('Sync status setup completed successfully');
  } catch (error) {
    console.error('Error setting up sync status:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the function
createSyncStatusTable()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  });
