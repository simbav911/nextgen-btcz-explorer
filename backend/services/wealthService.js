const logger = require('../utils/logger');
const { getBlockchainInfo } = require('./bitcoinzService');
const { getAddress } = require('../models'); // Correctly import the model getter
const { Op } = require('sequelize');
const { getSequelize } = require('../db'); // Import getSequelize

// Simple in-memory cache
const cache = {
  topHolders: { data: null, timestamp: 0 },
  distribution: { data: null, timestamp: 0 },
  totalSupply: { data: null, timestamp: 0 },
};
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

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

// Get the total supply with caching
async function getTotalSupply() {
  const now = Date.now();
  if (cache.totalSupply.data && (now - cache.totalSupply.timestamp < CACHE_DURATION_MS)) {
    logger.info('Returning cached total supply');
    return cache.totalSupply.data;
  }

  try {
    const blockchainInfo = await getBlockchainInfo();
    if (blockchainInfo && blockchainInfo.blocks) {
      const currentHeight = blockchainInfo.blocks;
      const supply = calculateCirculatingSupply(currentHeight);
      logger.info(`Calculated circulating supply: ${supply} BTCZ`);
      cache.totalSupply.data = supply;
      cache.totalSupply.timestamp = now;
      return supply;
    }
  } catch (error) {
    logger.warn('Error calculating supply:', error.message);
  }
  // Fallback, but don't cache this default if calculation failed
  return 21000000; 
}

// Get top holders (Refactored to use Database with proper balance filtering and caching)
async function getTopHolders(limit = 100) {
  const now = Date.now();
  // Cache key could be more specific if limit changes often, but for now, one cache for default limit.
  // For simplicity, we'll cache based on a general request, assuming limit is mostly 100.
  // A more robust cache would use `limit` in its key.
  if (cache.topHolders.data && (now - cache.topHolders.timestamp < CACHE_DURATION_MS) && limit <= 100) {
     // Only return cache if requested limit is within cached limit (assuming cache stores for 100)
    logger.info(`Returning cached top holders (limit: ${limit})`);
    // If cached data is for a larger limit, slice it.
    return cache.topHolders.data.slice(0, limit);
  }

  try {
    logger.info(`Fetching top ${limit} holders from database - requested limit: ${limit}`);
    const totalSupply = await getTotalSupply(); // This will also use its cache
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
    
    cache.topHolders.data = holders; // Cache the full fetched list (typically 100)
    cache.topHolders.timestamp = now;
    return holders.slice(0, limit); // Return the requested slice

  } catch (error) {
    logger.error('Error fetching top holders from database:', error);
    return [];
  }
}

// Get wealth distribution (Optimized with a single raw SQL query and caching)
async function getDistribution() {
  const now = Date.now();
  if (cache.distribution.data && (now - cache.distribution.timestamp < CACHE_DURATION_MS)) {
    logger.info('Returning cached wealth distribution');
    return cache.distribution.data;
  }

  logger.info('Calculating wealth distribution from database using optimized query');
  const sequelize = getSequelize();
  const Address = await getAddress(); // To get total address count easily

  // Define balance ranges for the CASE statement and for mapping results
  const rangesConfig = [
    { label: '0 - 1', min: 0, max: 1, sqlCondition: 'balance >= 0 AND balance < 1' },
    { label: '1 - 10', min: 1, max: 10, sqlCondition: 'balance >= 1 AND balance < 10' },
    { label: '10 - 100', min: 10, max: 100, sqlCondition: 'balance >= 10 AND balance < 100' },
    { label: '100 - 1000', min: 100, max: 1000, sqlCondition: 'balance >= 100 AND balance < 1000' },
    { label: '1000 - 10000', min: 1000, max: 10000, sqlCondition: 'balance >= 1000 AND balance < 10000' },
    { label: '10000 - 100000', min: 10000, max: 100000, sqlCondition: 'balance >= 10000 AND balance < 100000' },
    { label: '100000 - 1000000', min: 100000, max: 1000000, sqlCondition: 'balance >= 100000 AND balance < 1000000' },
    { label: '1000000 - ∞', min: 1000000, max: Infinity, sqlCondition: 'balance >= 1000000' }
  ];

  // Construct the CASE statement for SQL query
  const caseStatements = rangesConfig.map(r => `WHEN ${r.sqlCondition} THEN '${r.label}'`).join('\n    ');
  
  // Table name might be "Addresses" or "addresses" depending on Sequelize model definition and DB casing
  // Assuming "Addresses" as per typical Sequelize model naming. Adjust if necessary.
  const tableName = Address.tableName || 'Addresses'; 

  const query = `
    SELECT
      CASE
        ${caseStatements}
        ELSE 'Other' -- Fallback, though ideally all balances are covered
      END AS balance_range_label,
      COUNT(*) AS count
    FROM "${tableName}"
    GROUP BY balance_range_label;
  `;

  try {
    const results = await sequelize.query(query, { type: sequelize.QueryTypes.SELECT });
    const totalAddresses = await Address.count(); // Still efficient for total count

    // Map results to the desired format, ensuring all ranges are present even if count is 0
    const distributionMap = new Map(results.map(r => [r.balance_range_label, parseInt(r.count, 10)]));
    
    const distribution = rangesConfig.map(rc => ({
      range: rc.label,
      count: distributionMap.get(rc.label) || 0,
      min: rc.min,
      max: rc.max
    }));
    
    // Ensure the order is correct as per rangesConfig
    distribution.sort((a, b) => {
        const aIndex = rangesConfig.findIndex(r => r.label === a.range);
        const bIndex = rangesConfig.findIndex(r => r.label === b.range);
        return aIndex - bIndex;
    });


    logger.info(`Calculated distribution for ${totalAddresses} addresses using optimized query`);
    
    const result = { distribution, totalAddresses };
    cache.distribution.data = result;
    cache.distribution.timestamp = now;
    return result;

  } catch (error) {
    logger.error('Error calculating wealth distribution from database with optimized query:', error);
    return { distribution: [], totalAddresses: 0 }; // Fallback
  }
}

// Fallback functions are no longer needed and have been removed.

module.exports = {
  getTopHolders,
  getDistribution,
  getTotalSupply
};
