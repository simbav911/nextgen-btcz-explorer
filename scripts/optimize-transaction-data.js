require('dotenv').config(); // Load .env from CWD or parent directories
const { Pool } = require('pg');
// Revert logger path to original relative path
const logger = require('../backend/utils/logger');

// Configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'bitcoinz_explorer',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
};

const BATCH_SIZE = 1000; // Process transactions in batches

// --- Helper functions to process vin/vout (copied from syncService.js for consistency) ---
const processVin = (vinArray) => {
  if (!vinArray || !Array.isArray(vinArray)) return [];
  return vinArray.map(input => ({
    txid: input?.txid,
    vout: input?.vout,
    sequence: input?.sequence,
    coinbase: input?.coinbase,
    // Include address and value if they exist in the original data
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
// --- End Helper Functions ---

async function optimizeTransactionData() {
  logger.info('Starting transaction data optimization script...');
  logger.info(`Attempting to connect to DB: host=${DB_CONFIG.host}, port=${DB_CONFIG.port}, database=${DB_CONFIG.database}, user=${DB_CONFIG.user}`);
  
  const pool = new Pool(DB_CONFIG);
  let client;
  let updatedCount = 0;
  let processedCount = 0;
  let offset = 0;

  try {
    client = await pool.connect();
    logger.info('Database connection established.');

    // Get total count for progress estimation
    const totalResult = await client.query('SELECT COUNT(*) FROM transactions');
    const totalTransactions = parseInt(totalResult.rows[0].count, 10);
    logger.info(`Total transactions to process: ${totalTransactions}`);

    while (true) {
      logger.info(`Fetching batch starting from offset ${offset}...`);
      const batchResult = await client.query(
        'SELECT txid, vin, vout FROM transactions ORDER BY blocktime OFFSET $1 LIMIT $2',
        [offset, BATCH_SIZE]
      );

      const transactions = batchResult.rows;
      if (transactions.length === 0) {
        logger.info('No more transactions to process.');
        break; // Exit loop when no more rows are returned
      }

      logger.info(`Processing batch of ${transactions.length} transactions...`);

      for (const tx of transactions) {
        processedCount++;
        let originalVin, originalVout;
        try {
          // Handle cases where vin/vout might be null or already processed (stringified JSON)
          originalVin = tx.vin ? (typeof tx.vin === 'string' ? JSON.parse(tx.vin) : tx.vin) : [];
          originalVout = tx.vout ? (typeof tx.vout === 'string' ? JSON.parse(tx.vout) : tx.vout) : [];

          const optimizedVin = processVin(originalVin);
          const optimizedVout = processVout(originalVout);

          // Convert back to JSON string for comparison/update if needed by DB driver/query
          const optimizedVinJson = JSON.stringify(optimizedVin);
          const optimizedVoutJson = JSON.stringify(optimizedVout);
          const originalVinJson = JSON.stringify(originalVin); // For comparison
          const originalVoutJson = JSON.stringify(originalVout); // For comparison

          // Only update if the optimized version is different (and smaller)
          // Note: Simple string comparison might not be perfect for deep equality but is a good heuristic
          if (optimizedVinJson !== originalVinJson || optimizedVoutJson !== originalVoutJson) {
             // Use parameterized query to prevent SQL injection
             await client.query(
               'UPDATE transactions SET vin = $1::jsonb, vout = $2::jsonb WHERE txid = $3',
               [optimizedVinJson, optimizedVoutJson, tx.txid]
             );
             updatedCount++;
             // logger.debug(`Updated transaction ${tx.txid}`);
          } else {
             // logger.debug(`Skipping transaction ${tx.txid} - already optimized or no change.`);
          }

        } catch (parseError) {
          logger.error(`Error processing transaction ${tx.txid}: ${parseError.message}. Skipping.`);
          // Continue to the next transaction
        }
         if (processedCount % 100 === 0) { // Log progress every 100 transactions
             logger.info(`Processed ${processedCount}/${totalTransactions} transactions... (${updatedCount} updated)`);
         }
      }

      offset += transactions.length; // Move to the next batch
    }

    logger.info(`Optimization complete. Processed ${processedCount} transactions, updated ${updatedCount}.`);

  } catch (error) {
    logger.error('Error during transaction data optimization:', error);
  } finally {
    if (client) {
      client.release();
      logger.info('Database client released.');
    }
    await pool.end();
    logger.info('Database pool closed.');
  }
}

// Run the optimization function
optimizeTransactionData();