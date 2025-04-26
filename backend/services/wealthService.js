const logger = require('../utils/logger');
const { getBlockchainInfo } = require('./bitcoinzService');
const { getAddress } = require('../models'); // Correctly import the model getter
const { Op } = require('sequelize');
const { getSequelize } = require('../db'); // Import getSequelize

// Helper function to calculate circulating supply based on block height
// (Keep this function as it is)
function calculateCirculatingSupply(blockHeight) {
  const initialReward = 12.5;
  const halvingInterval = 840000;
  let supply = 0;
  let currentReward = initialReward;
  let remainingBlocks = blockHeight;
  while (remainingBlocks > halvingInterval) {
    supply += halvingInterval * currentReward;
    currentReward /= 2;
    remainingBlocks -= halvingInterval;
  }
  supply += remainingBlocks * currentReward;
  return supply;
}

// Get the total supply
// (Keep this function as it is)
async function getTotalSupply() {
  try {
    const blockchainInfo = await getBlockchainInfo();
    if (blockchainInfo && blockchainInfo.blocks) {
      const currentHeight = blockchainInfo.blocks;
      const supply = calculateCirculatingSupply(currentHeight);
      logger.info(`Calculated circulating supply: ${supply} BTCZ`);
      return supply;
    }
  } catch (error) {
    logger.warn('Error calculating supply:', error.message);
  }
  return 21000000; // Default max supply
}

// Get top holders (Refactored to use Database with proper balance filtering)
async function getTopHolders(limit = 100) {
  try {
    logger.info(`Fetching top ${limit} holders from database - requested limit: ${limit}`);
    const totalSupply = await getTotalSupply();
    const Address = await getAddress(); // Get the initialized model instance
    const sequelize = getSequelize(); // Get the sequelize instance

    if (!Address) {
      logger.error('Failed to get Address model');
      return [];
    }

    // Ensure limit is a valid number
    const validLimit = parseInt(limit) || 100;
    logger.info(`Using limit: ${validLimit} for top holders query`);

    // Query the Address table with simpler filtering to ensure we get results
    // We'll focus on ensuring positive balances and proper ordering
    const topAddresses = await Address.findAll({
      attributes: ['address', 'balance', 'totalReceived', 'totalSent', 'txCount'],
      where: {
        balance: { [Op.gt]: 0 } // Only include addresses with positive balances
      },
      order: [['balance', 'DESC']],
      limit: validLimit, // Use our validated limit
      raw: true // Get plain objects
    });

    logger.info(`Query returned ${topAddresses.length} addresses`);

    // Calculate percentage correctly - no need to multiply by 100 again
    const holders = topAddresses.map(addr => {
      const percentValue = totalSupply > 0 ? (addr.balance / totalSupply) * 100 : 0;
      
      // Ensure percentage is a proper number (logs for debugging)
      logger.debug(`Address ${addr.address}: Balance=${addr.balance}, Supply=${totalSupply}, Percentage=${percentValue}`);
      
      return {
        ...addr,
        percentageOfSupply: percentValue
      };
    });

    logger.info(`Found ${holders.length} top holders from database`);
    
    // If we found no records with balances, check if there's an issue with the DB
    if (holders.length === 0) {
      logger.warn('No addresses with positive balances found - checking total addresses in DB');
      const totalAddressCount = await Address.count();
      logger.warn(`Total addresses in database: ${totalAddressCount}`);
      
      // If we have addresses but none with balances, there might be a data issue
      if (totalAddressCount > 0) {
        logger.warn('There are addresses in the database but none with positive balances - this may indicate a data issue');
      }
    }
    
    return holders;

  } catch (error) {
    logger.error('Error fetching top holders from database:', error);
    // Return empty array on error, frontend will handle mock data if necessary
    return [];
  }
}

// Get wealth distribution (Refactored to use Database)
async function getDistribution() {
  // Define balance ranges
  const ranges = [
    { min: 0, max: 1 },
    { min: 1, max: 10 },
    { min: 10, max: 100 },
    { min: 100, max: 1000 },
    { min: 1000, max: 10000 },
    { min: 10000, max: 100000 },
    { min: 100000, max: 1000000 },
    { min: 1000000, max: Infinity }
  ];

  let distribution = [];
  let totalAddresses = 0;

  try {
    const Address = await getAddress(); // Get the initialized model instance
    logger.info('Calculating wealth distribution from database');

    // Get total address count
    totalAddresses = await Address.count();

    // Count addresses in each range using separate queries
    for (const range of ranges) {
      let count;
      if (range.max === Infinity) {
        count = await Address.count({
          where: {
            balance: {
              [Op.gte]: range.min
            }
          }
        });
      } else {
        count = await Address.count({
          where: {
            balance: {
              [Op.gte]: range.min,
              [Op.lt]: range.max // Use less than for non-inclusive upper bound
            }
          }
        });
      }

      distribution.push({
        range: `${range.min} - ${range.max === Infinity ? '∞' : range.max}`,
        count,
        min: range.min,
        max: range.max
      });
    }

    logger.info(`Calculated distribution for ${totalAddresses} addresses`);
    return { distribution, totalAddresses };

  } catch (error) {
    logger.error('Error calculating wealth distribution from database:', error);
    // Return empty structure on error
    return { distribution: [], totalAddresses: 0 };
  }
}

// Fallback functions are no longer needed and have been removed.

module.exports = {
  getTopHolders,
  getDistribution,
  getTotalSupply
};
