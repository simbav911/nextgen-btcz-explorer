/**
 * balance-fix-cron.js
 * 
 * This script should be run periodically (e.g., via cron job) to ensure 
 * all address balances are correctly calculated in the BitcoinZ Explorer database.
 * 
 * Recommended schedule: Once per hour
 * Example cron entry: 0 * * * * /usr/bin/node /path/to/Modern\ Explorer/balance-fix-cron.js >> /var/log/bitcoinz-balance-fix.log 2>&1
 */

require('dotenv').config();
const { Pool } = require('pg');

// Create a database pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'bitcoinz_explorer',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

// Simple logger with timestamps
const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  warn: (msg) => console.log(`[WARN] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.log(`[ERROR] ${new Date().toISOString()} - ${msg}`)
};

async function fixAddressBalances() {
  logger.info('Running scheduled address balance fix job');
  const client = await pool.connect();
  
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    // 1. Fix inconsistent balances (where balance != total_received - total_sent)
    const inconsistentQuery = `
      UPDATE addresses
      SET 
        balance = total_received - total_sent,
        updated_at = NOW()
      WHERE balance != (total_received - total_sent)
      RETURNING address
    `;
    
    const inconsistentResult = await client.query(inconsistentQuery);
    logger.info(`Fixed ${inconsistentResult.rowCount} addresses with inconsistent balances`);
    
    // Log a few examples for monitoring
    if (inconsistentResult.rowCount > 0) {
      const exampleAddresses = inconsistentResult.rows.slice(0, 3).map(row => row.address).join(', ');
      logger.info(`Examples of fixed addresses: ${exampleAddresses}${inconsistentResult.rowCount > 3 ? '...' : ''}`);
    }
    
    // 2. Fix any negative balances (shouldn't happen in theory, but just in case)
    const negativeQuery = `
      UPDATE addresses
      SET balance = 0, updated_at = NOW()
      WHERE balance < 0
      RETURNING address
    `;
    
    const negativeResult = await client.query(negativeQuery);
    if (negativeResult.rowCount > 0) {
      logger.warn(`Fixed ${negativeResult.rowCount} addresses with negative balances`);
    }
    
    // 3. Ensure no addresses with activity have zero balances incorrectly
    const zeroBalanceQuery = `
      UPDATE addresses
      SET 
        balance = total_received - total_sent,
        updated_at = NOW()
      WHERE 
        balance = 0 AND 
        total_received > total_sent AND
        total_received > 0
      RETURNING address
    `;
    
    const zeroBalanceResult = await client.query(zeroBalanceQuery);
    if (zeroBalanceResult.rowCount > 0) {
      logger.info(`Fixed ${zeroBalanceResult.rowCount} addresses with incorrect zero balances`);
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    
    // Get current top 5 holders for monitoring
    const topHoldersQuery = `
      SELECT address, balance, total_received, total_sent 
      FROM addresses 
      WHERE balance > 0
      ORDER BY balance DESC 
      LIMIT 5
    `;
    
    const topHoldersResult = await client.query(topHoldersQuery);
    
    logger.info('Current top 5 holders:');
    for (const row of topHoldersResult.rows) {
      logger.info(`Address: ${row.address.substring(0, 12)}..., Balance: ${row.balance}`);
    }
    
    logger.info('Address balance fix job completed successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Error fixing address balances: ${error.message}`);
    logger.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixAddressBalances().catch(error => {
  logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
