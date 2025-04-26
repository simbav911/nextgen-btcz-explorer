/**
 * startup-balance-check.js
 * 
 * This script performs a thorough address balance validation at startup.
 * It should be added to your application's startup sequence.
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Create a database pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'bitcoinz_explorer',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

// Create log directory if it doesn't exist
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Log file for balance check operations
const logFile = path.join(logDir, 'balance-check.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Simple logger with timestamps
const logger = {
  info: (msg) => {
    const logMessage = `[INFO] ${new Date().toISOString()} - ${msg}`;
    console.log(logMessage);
    logStream.write(logMessage + '\n');
  },
  warn: (msg) => {
    const logMessage = `[WARN] ${new Date().toISOString()} - ${msg}`;
    console.log(logMessage);
    logStream.write(logMessage + '\n');
  },
  error: (msg) => {
    const logMessage = `[ERROR] ${new Date().toISOString()} - ${msg}`;
    console.error(logMessage);
    logStream.write(logMessage + '\n');
  }
};

async function validateAddressBalances() {
  logger.info('Starting address balance validation at startup');
  const client = await pool.connect();
  
  try {
    // 1. Get database stats
    const statsQuery = await client.query(`
      SELECT
        COUNT(*) as total_addresses,
        COUNT(*) FILTER (WHERE balance != (total_received - total_sent)) as inconsistent_count,
        COUNT(*) FILTER (WHERE balance < 0) as negative_count,
        COUNT(*) FILTER (WHERE balance > 0) as positive_count,
        COALESCE(SUM(balance) FILTER (WHERE balance > 0), 0) as total_balance,
        MAX(balance) as max_balance
      FROM addresses
    `);
    
    const stats = statsQuery.rows[0];
    logger.info(`Database stats: ${JSON.stringify(stats)}`);
    
    // 2. Fix inconsistent balances
    logger.info('Fixing inconsistent balances...');
    const updateQuery = `
      UPDATE addresses
      SET 
        balance = CASE WHEN (total_received - total_sent) < 0 THEN 0 ELSE (total_received - total_sent) END,
        updated_at = NOW()
      WHERE balance != (CASE WHEN (total_received - total_sent) < 0 THEN 0 ELSE (total_received - total_sent) END)
      RETURNING address
    `;
    
    const updateResult = await client.query(updateQuery);
    logger.info(`Fixed ${updateResult.rowCount} addresses with inconsistent balances`);
    
    // 3. Get top holders after fix
    const topHoldersQuery = `
      SELECT address, balance, total_received, total_sent 
      FROM addresses 
      WHERE balance > 0
      ORDER BY balance DESC 
      LIMIT 10
    `;
    
    const topHoldersResult = await client.query(topHoldersQuery);
    
    logger.info('Top 10 holders after fix:');
    for (const [index, row] of topHoldersResult.rows.entries()) {
      logger.info(`#${index + 1}: ${row.address} - Balance: ${row.balance}`);
    }
    
    // 4. Create a status file to indicate successful check
    const statusFile = path.join(__dirname, 'balance-check-status.json');
    const statusData = {
      timestamp: new Date().toISOString(),
      totalAddresses: stats.total_addresses,
      fixedAddresses: updateResult.rowCount,
      positiveBalances: stats.positive_count,
      totalBalance: stats.total_balance,
      topHolder: topHoldersResult.rows[0]?.address || 'None',
      success: true
    };
    
    fs.writeFileSync(statusFile, JSON.stringify(statusData, null, 2));
    logger.info(`Balance check completed and status saved to ${statusFile}`);
    
    return {
      success: true,
      fixedCount: updateResult.rowCount,
      totalAddresses: stats.total_addresses
    };
    
  } catch (error) {
    logger.error(`Error validating address balances: ${error.message}`);
    logger.error(error.stack);
    return {
      success: false,
      error: error.message
    };
  } finally {
    client.release();
    await pool.end();
    logStream.end();
  }
}

// Run the validation
validateAddressBalances().then(result => {
  if (result.success) {
    console.log(`✅ Address balance validation completed successfully. Fixed ${result.fixedCount} of ${result.totalAddresses} addresses.`);
    process.exit(0);
  } else {
    console.error(`❌ Address balance validation failed: ${result.error}`);
    process.exit(1);
  }
}).catch(err => {
  console.error(`Fatal error during validation: ${err.message}`);
  process.exit(1);
});
