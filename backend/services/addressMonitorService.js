/**
 * Address Monitor Service
 * 
 * This service monitors and maintains address data integrity by:
 * 1. Periodically checking for zero balance addresses with non-zero received/sent
 * 2. Correcting inconsistent balances
 * 3. Ensuring new addresses are properly tracked
 */

const logger = require('../utils/logger');
const { getAddress } = require('../models');
const { Op } = require('sequelize');
const { getSequelize } = require('../db');

// Configuration
const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const IMMEDIATE_CHECK_DELAY = 30 * 1000; // Run first check after 30 seconds
const RECOVERY_CHECK_INTERVAL = 60 * 1000; // Recovery check interval (1 minute)
const MAX_RETRY_ATTEMPTS = 3; // Maximum retry attempts

let monitorIntervalId = null;
let recoveryIntervalId = null;
let isRunning = false;
let consecutiveFailures = 0;

/**
 * Start the address monitor service with recovery capability
 */
const startMonitoring = () => {
  logger.info('Starting address monitor service');
  
  // Clear any existing intervals just in case
  stopMonitoring(false);
  
  // Run first check after a delay to let the system initialize
  setTimeout(() => {
    // Run the initial check
    runBalanceCheck();
    
    // Set up interval for periodic checks
    monitorIntervalId = setInterval(runBalanceCheck, CHECK_INTERVAL);
    
    logger.info(`Address monitor service started - will check every ${CHECK_INTERVAL/60000} minutes`);
  }, IMMEDIATE_CHECK_DELAY);
};

/**
 * Run a balance check with error handling and recovery
 */
const runBalanceCheck = async () => {
  // Prevent concurrent runs
  if (isRunning) {
    logger.debug('Address balance check already running, skipping this execution');
    return;
  }
  
  isRunning = true;
  
  try {
    logger.info('Running scheduled address balance check');
    await fixInconsistentBalances();
    
    // Reset failure counter on success
    consecutiveFailures = 0;
    
    // Clear recovery interval if it exists
    if (recoveryIntervalId) {
      clearInterval(recoveryIntervalId);
      recoveryIntervalId = null;
      logger.info('Normal balance checking schedule resumed');
    }
    
  } catch (error) {
    consecutiveFailures++;
    logger.error(`Address balance check failed (attempt ${consecutiveFailures}): ${error.message}`);
    
    // Set up recovery interval if we have consecutive failures
    if (consecutiveFailures >= MAX_RETRY_ATTEMPTS && !recoveryIntervalId) {
      logger.warn(`Multiple balance check failures detected. Setting up recovery interval (every ${RECOVERY_CHECK_INTERVAL/1000}s)`);
      recoveryIntervalId = setInterval(() => {
        logger.info('Attempting recovery of address balance check service...');
        runBalanceCheck();
      }, RECOVERY_CHECK_INTERVAL);
    }
  } finally {
    isRunning = false;
  }
};

/**
 * Stop the address monitor service
 */
const stopMonitoring = () => {
  logger.info('Stopping address monitor service');
  
  if (monitorIntervalId) {
    clearInterval(monitorIntervalId);
    monitorIntervalId = null;
  }
  
  logger.info('Address monitor service stopped');
};

/**
 * Fix addresses with inconsistent balances using batch processing
 */
const fixInconsistentBalances = async () => {
  try {
    logger.info('Checking for addresses with inconsistent balances');
    
    const Address = await getAddress();
    const sequelize = getSequelize();
    
    if (!Address || !sequelize) {
      logger.error('Failed to get Address model or database connection');
      return;
    }
    
    // Initialize statistics
    let totalFixed = 0;
    let totalNegativeFixed = 0;
    let highValueAddressesFixed = 0;
    let batchCount = 0;
    
    // Check if we should use direct SQL for faster processing
    let useDirectSql = false;
    try {
      // Test if we can use raw queries (more efficient for large batches)
      await sequelize.query('SELECT 1');
      useDirectSql = true;
      logger.info('Using direct SQL queries for faster balance correction');
    } catch (sqlError) {
      logger.warn('Could not use direct SQL, falling back to model operations');
    }
    
    // If direct SQL is available, perform a bulk update first
    if (useDirectSql) {
      try {
        // Use SQL to directly fix balances in bulk
        const bulkFixResult = await sequelize.query(`
          UPDATE addresses SET 
            balance = CASE 
              WHEN (total_received - total_sent) < 0 THEN 0 
              ELSE (total_received - total_sent) 
            END,
            updated_at = NOW()
          WHERE balance != (CASE 
            WHEN (total_received - total_sent) < 0 THEN 0 
            ELSE (total_received - total_sent) 
          END)
          RETURNING address
        `);
        
        const updatedCount = bulkFixResult[1]?.rowCount || 0;
        if (updatedCount > 0) {
          logger.info(`Bulk fixed ${updatedCount} addresses with SQL`);
          totalFixed += updatedCount;
        }
      } catch (bulkError) {
        logger.error('Error during bulk SQL fix:', bulkError.message);
        useDirectSql = false; // Fall back to model operations
      }
    }
    
    // Determine if we still need to process with the model approach
    if (!useDirectSql || totalFixed === 0) {
      // Process in multiple smaller batches to avoid memory issues
      const BATCH_SIZE = 500;
      let hasMoreAddresses = true;
      let offset = 0;
      
      while (hasMoreAddresses) {
        batchCount++;
        logger.info(`Processing batch #${batchCount} (offset ${offset}, limit ${BATCH_SIZE})`);
        
        // Find addresses with inconsistent balances
        const inconsistentAddresses = await Address.findAll({
          attributes: ['address', 'balance', 'totalReceived', 'totalSent', 'txCount'],
          where: {
            [Op.or]: [
              // Case 1: Balance doesn't match received-sent
              sequelize.literal('balance != (CASE WHEN (total_received - total_sent) < 0 THEN 0 ELSE (total_received - total_sent) END)'),
              // Case 2: Zero balance but non-zero activity that should result in a positive balance
              {
                balance: 0,
                totalReceived: { [Op.gt]: sequelize.col('total_sent') }
              }
            ]
          },
          limit: BATCH_SIZE,
          offset: offset,
          order: [['balance', 'DESC']] // Process high-value addresses first
        });
        
        if (inconsistentAddresses.length === 0) {
          hasMoreAddresses = false;
          logger.info(`No more addresses to process after ${batchCount} batches`);
          break;
        }
        
        logger.info(`Found ${inconsistentAddresses.length} addresses with inconsistent balances in batch #${batchCount}`);
        
        // Log a few examples for debugging
        let examplesLogged = 0;
        for (const addr of inconsistentAddresses) {
          const expectedBalance = Math.max(0, parseFloat(addr.totalReceived) - parseFloat(addr.totalSent));
          const diff = Math.abs(addr.balance - expectedBalance);
          
          // Log high-value addresses or addresses with significant discrepancies
          if ((expectedBalance > 1000 || addr.balance > 1000 || diff > 100) && examplesLogged < 5) {
            logger.info(`High-value address: ${addr.address}, Current: ${addr.balance}, Expected: ${expectedBalance}, Diff: ${diff}, Tx Count: ${addr.txCount}`);
            examplesLogged++;
          }
        }
        
        // Start a transaction for updates
        const transaction = await sequelize.transaction();
        
        try {
          let batchUpdatedCount = 0;
          let batchNegativeCount = 0;
          let batchHighValueCount = 0;
          
          // Process each address
          for (const addr of inconsistentAddresses) {
            const expectedBalance = parseFloat(addr.totalReceived) - parseFloat(addr.totalSent);
            const isHighValue = addr.balance > 1000 || expectedBalance > 1000;
            
            // Update address with correct balance
            if (expectedBalance < 0) {
              // Handle negative balances (these shouldn't occur in normal operation)
              await addr.update({
                balance: 0,
                lastUpdated: new Date()
              }, { transaction });
              batchNegativeCount++;
            } else {
              await addr.update({
                balance: expectedBalance,
                lastUpdated: new Date()
              }, { transaction });
              batchUpdatedCount++;
              
              if (isHighValue) {
                batchHighValueCount++;
              }
            }
          }
          
          // Commit transaction
          await transaction.commit();
          
          // Update statistics
          totalFixed += batchUpdatedCount;
          totalNegativeFixed += batchNegativeCount;
          highValueAddressesFixed += batchHighValueCount;
          
          logger.info(`Batch #${batchCount} completed: Fixed ${batchUpdatedCount} addresses, zeroed ${batchNegativeCount} negative balances, fixed ${batchHighValueCount} high-value addresses`);
          
          // Move to next batch
          offset += BATCH_SIZE;
          
          // If we processed less than the batch size, we're done
          if (inconsistentAddresses.length < BATCH_SIZE) {
            hasMoreAddresses = false;
            logger.info('Reached end of inconsistent addresses');
          }
          
        } catch (error) {
          // Rollback on error
          await transaction.rollback();
          logger.error(`Error in batch #${batchCount}:`, error);
          // Continue to next batch anyway
          offset += BATCH_SIZE;
        }
      }
    }
    
    // Final statistics
    logger.info(`===== Balance Check Summary =====`);
    logger.info(`Total addresses fixed: ${totalFixed}`);
    logger.info(`Total negative balances zeroed: ${totalNegativeFixed}`);
    logger.info(`High-value addresses fixed: ${highValueAddressesFixed}`);
    logger.info(`Total batches processed: ${batchCount}`);
    
    // Check top holders after fix
    try {
      const topHolders = await Address.findAll({
        attributes: ['address', 'balance', 'totalReceived', 'totalSent'],
        where: { balance: { [Op.gt]: 0 } },
        order: [['balance', 'DESC']],
        limit: 5
      });
      
      if (topHolders.length > 0) {
        logger.info('Current top 5 holders after balance check:');
        topHolders.forEach((holder, idx) => {
          logger.info(`#${idx+1}: ${holder.address.substring(0, 12)}... Balance: ${holder.balance}`);
        });
      }
    } catch (topError) {
      logger.warn('Could not fetch top holders after fix:', topError.message);
    }
    
    return {
      totalFixed,
      totalNegativeFixed,
      highValueAddressesFixed,
      batchCount
    };
    
  } catch (error) {
    logger.error('Error fixing inconsistent balances:', error);
    throw error; // Re-throw to allow caller to handle
  }
};

module.exports = {
  startMonitoring,
  stopMonitoring,
  fixInconsistentBalances
};
