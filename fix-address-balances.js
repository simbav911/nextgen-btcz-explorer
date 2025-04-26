/**
 * fix-address-balances.js
 * 
 * This script recalculates and corrects all address balances in the database.
 * Run this to fix the zero balance issue for top holders.
 */

require('dotenv').config();
const { Pool } = require('pg');
const logger = require('./backend/utils/logger');

// Create a database pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'bitcoinz_explorer',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function fixAddressBalances() {
  const client = await pool.connect();
  
  try {
    logger.info('Starting address balance fix script...');
    
    // Get total address count
    const countResult = await client.query('SELECT COUNT(*) FROM addresses');
    const totalAddresses = parseInt(countResult.rows[0].count, 10);
    logger.info(`Total addresses to process: ${totalAddresses}`);
    
    // Get addresses with inconsistent balances
    const inconsistentQuery = `
      SELECT address, balance, total_received, total_sent 
      FROM addresses 
      WHERE balance != (total_received - total_sent)
      LIMIT 10
    `;
    
    const inconsistentResult = await client.query(inconsistentQuery);
    
    if (inconsistentResult.rows.length > 0) {
      logger.info(`Found ${inconsistentResult.rows.length} addresses with inconsistent balances (showing max 10):`);
      for (const row of inconsistentResult.rows) {
        const expectedBalance = parseFloat(row.total_received) - parseFloat(row.total_sent);
        logger.info(`Address ${row.address}: Current balance: ${row.balance}, Expected: ${expectedBalance}`);
      }
    } else {
      logger.info('No addresses with inconsistent balances found.');
    }
    
    // Start transaction for the update
    await client.query('BEGIN');
    
    // Update all address balances
    const updateQuery = `
      UPDATE addresses 
      SET balance = (total_received - total_sent),
          updated_at = NOW()
    `;
    
    const updateResult = await client.query(updateQuery);
    
    logger.info(`Updated ${updateResult.rowCount} address balances.`);
    
    // Check for negative balances
    const negativeQuery = `
      SELECT COUNT(*) FROM addresses 
      WHERE balance < 0
    `;
    
    const negativeResult = await client.query(negativeQuery);
    const negativeCount = parseInt(negativeResult.rows[0].count, 10);
    
    if (negativeCount > 0) {
      logger.warn(`Found ${negativeCount} addresses with negative balances after update.`);
      
      // Fix negative balances
      const fixNegativeQuery = `
        UPDATE addresses 
        SET balance = 0
        WHERE balance < 0
      `;
      
      const fixResult = await client.query(fixNegativeQuery);
      logger.info(`Fixed ${fixResult.rowCount} negative balances by setting them to 0.`);
    } else {
      logger.info('No negative balances found.');
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    
    // Get top holders after the fix
    const topHoldersQuery = `
      SELECT address, balance, total_received, total_sent 
      FROM addresses 
      WHERE balance > 0
      ORDER BY balance DESC 
      LIMIT 10
    `;
    
    const topHoldersResult = await client.query(topHoldersQuery);
    
    logger.info('Top holders after fix:');
    for (const row of topHoldersResult.rows) {
      logger.info(`Address: ${row.address}, Balance: ${row.balance}`);
    }
    
    logger.info('Address balance fix completed successfully.');
    
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
