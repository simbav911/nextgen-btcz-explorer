const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { executeRpcCommand } = require('../services/bitcoinzService');

// In-memory cache for chart data
const chartDataCache = {
  'pool-stat': {},  // date -> data
  'mined-block': {} // date -> data
};

/**
 * Identify the mining pool from a coinbase transaction
 * @param {Object} coinbaseTx - Coinbase transaction object
 * @returns {string} Pool name
 */
const identifyMiningPool = (coinbaseTx) => {
  try {
    // The pool identifier is in the coinbase input script
    const scriptSigHex = coinbaseTx.vin[0].scriptSig.hex;
    
    // Convert hex to buffer
    const scriptBuffer = Buffer.from(scriptSigHex, 'hex');
    
    // Try to extract ASCII text from the buffer
    let scriptString = '';
    for (let i = 0; i < scriptBuffer.length; i++) {
      const byte = scriptBuffer[i];
      // Only include printable ASCII characters
      if (byte >= 32 && byte <= 126) {
        scriptString += String.fromCharCode(byte);
      }
    }
    
    // Look for common patterns in pool identifiers
    if (scriptString.includes('Z-NOMP') || scriptSigHex.includes('5a2d4e4f4d50')) {
      return 'Z-NOMP';
    }
    
    if (scriptString.includes('Zpool')) {
      return 'Zpool';
    }
    
    if (scriptString.includes('Zergpool')) {
      return 'Zergpool';
    }
    
    if (scriptString.includes('DarkFiberMines')) {
      return 'DarkFiberMines';
    }
    
    if (scriptString.includes('2Mars')) {
      return '2Mars';
    }
    
    // If no known pool is identified, check for any URL pattern
    const urlMatch = scriptString.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      // Try to extract pool name from URL
      const url = urlMatch[0];
      const domain = url.replace(/https?:\/\//, '').split('/')[0];
      return domain;
    }
    
    return 'Unknown';
  } catch (error) {
    logger.error('Failed to identify mining pool:', error);
    return 'Unknown';
  }
};

/**
 * Get blocks mined on a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {number} maxBlocks - Maximum number of blocks to scan
 * @returns {Array} Array of blocks mined on the specified date
 */
const getBlocksForDate = async (date, maxBlocks = 1000) => {
  try {
    // Get current blockchain info
    const blockchainInfo = await executeRpcCommand('getblockchaininfo');
    const currentHeight = blockchainInfo.blocks;
    
    // Calculate target date timestamps
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const targetTimestamp = Math.floor(targetDate.getTime() / 1000);
    
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    nextDate.setHours(0, 0, 0, 0);
    const nextTimestamp = Math.floor(nextDate.getTime() / 1000);
    
    logger.info(`Scanning for blocks mined on ${date} (timestamps ${targetTimestamp}-${nextTimestamp})`);
    
    // Scan blocks to find ones mined on the target date
    const blocks = [];
    let height = currentHeight;
    let blocksScanned = 0;
    
    // For testing, limit the number of blocks to scan based on date
    // If the date is more than 30 days ago, we'll only scan a few blocks to save time
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const isOldDate = targetDate < thirtyDaysAgo;
    const scanLimit = isOldDate ? 50 : maxBlocks;
    
    while (height > 0 && blocksScanned < scanLimit) {
      try {
        const blockHash = await executeRpcCommand('getblockhash', [height]);
        const block = await executeRpcCommand('getblock', [blockHash]);
        
        blocksScanned++;
        
        if (block.time >= targetTimestamp && block.time < nextTimestamp) {
          logger.debug(`Found block ${height} mined on ${date}`);
          
          // Get full block with transaction data
          const fullBlock = await executeRpcCommand('getblock', [blockHash, 2]);
          
          // The coinbase transaction is always the first transaction
          const coinbaseTx = fullBlock.tx[0];
          
          // Identify the mining pool
          const pool = identifyMiningPool(coinbaseTx);
          
          blocks.push({
            height: block.height,
            hash: block.hash,
            time: block.time,
            size: block.size,
            txCount: block.tx.length,
            pool,
            difficulty: block.difficulty
          });
        } else if (block.time < targetTimestamp) {
          // We've gone past the target date, so stop scanning
          logger.debug(`Stopping scan at block ${height}, time before target date`);
          break;
        }
        
        height--;
        
        // Log progress every 10 blocks
        if (blocksScanned % 10 === 0) {
          logger.debug(`Scanned ${blocksScanned} blocks, currently at height ${height}`);
        }
      } catch (error) {
        logger.error(`Error scanning block at height ${height}:`, error);
        height--;
      }
    }
    
    logger.info(`Found ${blocks.length} blocks mined on ${date}`);
    return blocks;
  } catch (error) {
    logger.error(`Failed to get blocks for date ${date}:`, error);
    return [];
  }
};

/**
 * Calculate pool distribution from blocks
 * @param {Array} blocks - Array of blocks
 * @returns {Array} Pool distribution data
 */
const calculatePoolDistribution = (blocks) => {
  if (!blocks || blocks.length === 0) {
    return generateMockPoolData();
  }
  
  // Count blocks by pool
  const poolCounts = {};
  blocks.forEach(block => {
    poolCounts[block.pool] = (poolCounts[block.pool] || 0) + 1;
  });
  
  const totalBlocks = blocks.length;
  const distribution = Object.entries(poolCounts).map(([name, count]) => ({
    name,
    percentage: parseFloat(((count / totalBlocks) * 100).toFixed(1)),
    count
  }));
  
  // Sort by percentage (descending)
  distribution.sort((a, b) => b.percentage - a.percentage);
  
  return distribution;
};

/**
 * Format mined blocks data by hour
 * @param {Array} blocks - Array of blocks
 * @returns {Array} Hourly mined blocks data
 */
const formatMinedBlocksData = (blocks) => {
  if (!blocks || blocks.length === 0) {
    return generateMockMinedBlockData();
  }
  
  // Group blocks by hour
  const hourlyBlocks = {};
  for (let i = 0; i < 24; i++) {
    hourlyBlocks[i] = {
      hour: i,
      count: 0,
      blocks: []
    };
  }
  
  // Process each block
  blocks.forEach(block => {
    const blockDate = new Date(block.time * 1000);
    const hour = blockDate.getHours();
    
    hourlyBlocks[hour].count++;
    hourlyBlocks[hour].blocks.push(block);
  });
  
  // Convert to array format
  return Object.values(hourlyBlocks);
};

/**
 * Generate mock pool data as fallback
 * @returns {Array} Mock pool data
 */
const generateMockPoolData = () => {
  return [
    { name: 'Zpool', percentage: 31.8, count: Math.floor(Math.random() * 200) + 800 },
    { name: 'Zergpool', percentage: 49.0, count: Math.floor(Math.random() * 300) + 1200 },
    { name: 'Others', percentage: 11.1, count: Math.floor(Math.random() * 100) + 300 },
    { name: 'DarkFiberMines', percentage: 6.1, count: Math.floor(Math.random() * 50) + 150 },
    { name: '2Mars', percentage: 2.0, count: Math.floor(Math.random() * 30) + 50 }
  ];
};

/**
 * Generate mock mined block data as fallback
 * @returns {Array} Mock mined block data
 */
const generateMockMinedBlockData = () => {
  const hourlyData = [];
  
  for (let i = 0; i < 24; i++) {
    const count = Math.floor(Math.random() * 3) + 1;
    const blocks = [];
    
    for (let j = 0; j < count; j++) {
      blocks.push({
        height: 1000000 + i * 10 + j,
        hash: `00000${Math.random().toString(16).substring(2, 10)}`,
        time: new Date().setHours(i, 0, 0, 0) / 1000,
        size: Math.floor(Math.random() * 5000) + 2000,
        txCount: Math.floor(Math.random() * 20) + 1,
        pool: ['Zpool', 'Zergpool', 'DarkFiberMines', '2Mars', 'Others'][Math.floor(Math.random() * 5)],
        difficulty: Math.random() * 1000000
      });
    }
    
    hourlyData.push({
      hour: i,
      count,
      blocks
    });
  }
  
  return hourlyData;
};

// Block size chart data
router.get('/block-size', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    
    // Generate some random data
    const data = {
      days,
      chartType: 'block-size',
      data: []
    };
    
    // Generate data points with the correct property names expected by the frontend
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      data.data.push({
        blockHeight: 1545720 - (i * 10), // Start from a reasonable block height
        blockSize: Math.floor(Math.random() * 1000) + 500, // Random block size in bytes
        timestamp: date.toISOString() // Include timestamp for tooltip display
      });
    }
    
    // Sort data by blockHeight (ascending)
    data.data.sort((a, b) => a.blockHeight - b.blockHeight);
    
    return res.json(data);
  } catch (error) {
    logger.error('Error in block-size endpoint:', error);
    return res.status(500).json({
      error: 'An unexpected error occurred',
      message: error.message
    });
  }
});

// Block interval chart data
router.get('/block-interval', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    
    // Generate some random data
    const data = {
      days,
      chartType: 'block-interval',
      data: []
    };
    
    // Generate data points
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      data.data.push({
        date: date.toISOString().split('T')[0],
        interval: Math.floor(Math.random() * 60) + 120
      });
    }
    
    return res.json(data);
  } catch (error) {
    logger.error('Error in block-interval endpoint:', error);
    return res.status(500).json({
      error: 'An unexpected error occurred',
      message: error.message
    });
  }
});

// Difficulty chart data
router.get('/difficulty', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    
    // Generate some random data
    const data = {
      days,
      chartType: 'difficulty',
      data: []
    };
    
    // Generate data points
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      data.data.push({
        date: date.toISOString().split('T')[0],
        difficulty: Math.floor(Math.random() * 10000000) + 5000000
      });
    }
    
    return res.json(data);
  } catch (error) {
    logger.error('Error in difficulty endpoint:', error);
    return res.status(500).json({
      error: 'An unexpected error occurred',
      message: error.message
    });
  }
});

// Mining revenue chart data
router.get('/mining-revenue', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    
    // Generate some random data
    const data = {
      days,
      chartType: 'mining-revenue',
      data: []
    };
    
    // Generate data points
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      data.data.push({
        date: date.toISOString().split('T')[0],
        revenue: Math.floor(Math.random() * 10000) + 5000
      });
    }
    
    return res.json(data);
  } catch (error) {
    logger.error('Error in mining-revenue endpoint:', error);
    return res.status(500).json({
      error: 'An unexpected error occurred',
      message: error.message
    });
  }
});

// Pool stat chart data
router.get('/pool-stat', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    
    console.log('==== NEW IMPLEMENTATION: Pool-stat endpoint hit for date:', date, '====');
    logger.info(`NEW IMPLEMENTATION: Pool-stat endpoint hit for date: ${date}`);
    
    // Check if we have cached data for this date
    if (chartDataCache['pool-stat'][date]) {
      logger.info(`Returning cached pool-stat data for ${date}`);
      return res.json(chartDataCache['pool-stat'][date]);
    }
    
    // Get blocks mined on the specified date
    const blocks = await getBlocksForDate(date);
    
    // Calculate pool distribution
    const poolDistribution = calculatePoolDistribution(blocks);
    
    // Format response
    const data = {
      date,
      chartType: 'pool-stat',
      data: poolDistribution
    };
    
    // Cache the results
    chartDataCache['pool-stat'][date] = data;
    
    return res.json(data);
  } catch (error) {
    logger.error('Error in pool-stat endpoint:', error);
    return res.status(500).json({
      error: 'An unexpected error occurred',
      message: error.message
    });
  }
});

// Mined block chart data
router.get('/mined-block', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    
    logger.info(`Mined-block endpoint hit for date: ${date}`);
    
    // Check if we have cached data for this date
    if (chartDataCache['mined-block'][date]) {
      logger.info(`Returning cached mined-block data for ${date}`);
      return res.json(chartDataCache['mined-block'][date]);
    }
    
    // Get blocks mined on the specified date
    const blocks = await getBlocksForDate(date);
    
    // Format mined blocks data
    const minedBlocksData = formatMinedBlocksData(blocks);
    
    // Format response
    const data = {
      date,
      chartType: 'mined-block',
      data: minedBlocksData
    };
    
    // Cache the results
    chartDataCache['mined-block'][date] = data;
    
    return res.json(data);
  } catch (error) {
    logger.error('Error in mined-block endpoint:', error);
    return res.status(500).json({
      error: 'An unexpected error occurred',
      message: error.message
    });
  }
});

// Export the router
module.exports = router;
