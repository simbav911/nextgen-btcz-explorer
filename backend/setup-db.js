require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('./utils/logger');

// Get database configuration from environment variables
let {
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_USER,
  DB_PASSWORD
} = process.env;

// Use system username as fallback if no DB_USER is specified
if (!DB_USER) {
  DB_USER = os.userInfo().username;
  logger.info(`No DB_USER specified, using system username: ${DB_USER}`);
}

async function setupDatabase() {
  logger.info('Database setup started');
  
  try {
    // First try to connect to the postgres database
    logger.info(`Connecting to PostgreSQL with user: ${DB_USER}`);
    
    const adminPool = new Pool({
      host: DB_HOST,
      port: DB_PORT,
      database: 'postgres', // Connect to default database first
      user: DB_USER,
      password: DB_PASSWORD || undefined
    });

    // Test connection
    try {
      await adminPool.query('SELECT 1');
      logger.info('PostgreSQL connection successful');
    } catch (err) {
      logger.error(`Failed to connect to PostgreSQL: ${err.message}`);
      
      if (err.message.includes('does not exist')) {
        logger.info(`Trying with system username: ${os.userInfo().username}`);
        DB_USER = os.userInfo().username;
        
        // Update pool config
        adminPool.options.user = DB_USER;
        
        try {
          await adminPool.query('SELECT 1');
          logger.info(`Connection successful with user: ${DB_USER}`);
          
          // Update .env file with correct user
          const envPath = path.join(__dirname, '.env');
          if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, 'utf8');
            envContent = envContent.replace(/DB_USER=.*/, `DB_USER=${DB_USER}`);
            fs.writeFileSync(envPath, envContent);
            logger.info(`Updated .env file with DB_USER=${DB_USER}`);
          }
        } catch (innerErr) {
          logger.error(`Also failed with system username: ${innerErr.message}`);
          throw innerErr;
        }
      } else {
        throw err;
      }
    }

    // Check if our database exists
    const dbCheckResult = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [DB_NAME]
    );

    // If database doesn't exist, create it
    if (dbCheckResult.rows.length === 0) {
      logger.info(`Database ${DB_NAME} does not exist, creating...`);
      await adminPool.query(`CREATE DATABASE ${DB_NAME}`);
      logger.info(`Database ${DB_NAME} created successfully`);
    } else {
      logger.info(`Database ${DB_NAME} already exists`);
    }

    await adminPool.end();

    // Connect to our database to create schema
    const appPool = new Pool({
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      password: DB_PASSWORD || undefined
    });

    logger.info('Creating tables...');

    // Create blocks table
    await appPool.query(`
      CREATE TABLE IF NOT EXISTS blocks (
          hash VARCHAR(255) PRIMARY KEY,
          height INTEGER NOT NULL UNIQUE,
          confirmations INTEGER NOT NULL,
          size INTEGER NOT NULL,
          strippedsize INTEGER,
          weight INTEGER,
          version INTEGER NOT NULL,
          version_hex VARCHAR(255),
          merkleroot VARCHAR(255) NOT NULL,
          tx TEXT[] NOT NULL,
          time INTEGER NOT NULL,
          mediantime INTEGER,
          nonce VARCHAR(255) NOT NULL,
          bits VARCHAR(255) NOT NULL,
          difficulty FLOAT NOT NULL,
          chainwork VARCHAR(255),
          previousblockhash VARCHAR(255),
          nextblockhash VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('Blocks table created');

    // Create indexes for blocks
    await appPool.query(`
      CREATE INDEX IF NOT EXISTS idx_blocks_height ON blocks(height);
      CREATE INDEX IF NOT EXISTS idx_blocks_time ON blocks(time);
      CREATE INDEX IF NOT EXISTS idx_blocks_prev_hash ON blocks(previousblockhash);
      CREATE INDEX IF NOT EXISTS idx_blocks_next_hash ON blocks(nextblockhash);
    `);
    logger.info('Block indexes created');

    // Create transactions table
    await appPool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
          txid VARCHAR(255) PRIMARY KEY,
          hash VARCHAR(255),
          version INTEGER,
          size INTEGER,
          vsize INTEGER,
          weight INTEGER,
          locktime INTEGER,
          blockhash VARCHAR(255),
          confirmations INTEGER,
          time INTEGER,
          blocktime INTEGER,
          vin JSONB,
          vout JSONB,
          is_coinbase BOOLEAN DEFAULT FALSE,
          fee FLOAT,
          value_in FLOAT,
          value_out FLOAT,
          value_balance FLOAT,
          f_overwintered BOOLEAN,
          v_shielded_spend JSONB,
          v_shielded_output JSONB,
          binding_sig VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('Transactions table created');

    // Create indexes for transactions
    await appPool.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_blockhash ON transactions(blockhash);
      CREATE INDEX IF NOT EXISTS idx_transactions_time ON transactions(time);

      -- Create GIN indexes for JSON fields
      CREATE INDEX IF NOT EXISTS idx_transactions_vin ON transactions USING GIN (vin);
      CREATE INDEX IF NOT EXISTS idx_transactions_vout ON transactions USING GIN (vout);
    `);
    logger.info('Transaction JSON indexes created');

    // Create addresses table
    await appPool.query(`
      CREATE TABLE IF NOT EXISTS addresses (
          address VARCHAR(255) PRIMARY KEY,
          balance FLOAT DEFAULT 0,
          total_received FLOAT DEFAULT 0,
          total_sent FLOAT DEFAULT 0,
          unconfirmed_balance FLOAT DEFAULT 0,
          tx_count INTEGER DEFAULT 0,
          transactions TEXT[] DEFAULT '{}',
          last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('Addresses table created');

    // Create indexes for addresses
    await appPool.query(`
      CREATE INDEX IF NOT EXISTS idx_addresses_balance ON addresses(balance);
      CREATE INDEX IF NOT EXISTS idx_addresses_tx_count ON addresses(tx_count);
    `);
    logger.info('Address indexes created');

    // Create statistics table
    await appPool.query(`
      CREATE TABLE IF NOT EXISTS statistics (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          block_height INTEGER,
          difficulty FLOAT,
          hashrate BIGINT,
          supply FLOAT,
          transactions INTEGER,
          avg_block_time FLOAT,
          avg_tx_per_block FLOAT,
          peer_count INTEGER,
          mempool JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('Statistics table created');

    // Create indexes for statistics
    await appPool.query(`
      CREATE INDEX IF NOT EXISTS idx_statistics_timestamp ON statistics(timestamp);
    `);
    logger.info('Statistics indexes created');

    logger.info('Database schema initialized successfully');
    await appPool.end();

    return true;
  } catch (error) {
    logger.error('Error setting up database:', error);
    throw error;
  }
}

// Run the setup if this script is executed directly
if (require.main === module) {
  setupDatabase()
    .then(() => {
      logger.info('Database setup completed successfully');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Database setup failed:', error);
      process.exit(1);
    });
}

module.exports = setupDatabase;
