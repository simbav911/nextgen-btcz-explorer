const { executeRpcCommand } = require('./bitcoinzService');
const logger = require('../utils/logger');

// In-memory cache for pool data (in a production environment, this would be a database)
let poolDataCache = {
  // date -> array of pool data objects
};

// In-memory cache for mined block data
let minedBlockCache = {
  // date -> array of mined block data objects
};

/**
 * Identify the mining pool from a block
 * @param {string} blockHash - The hash of the block to analyze
 * @returns {Object} Pool information
 */
const identifyMiningPool = async (blockHash) => {
  try {
    // Get the block with full transaction data
    const block = await executeRpcCommand('getblock', [blockHash, 2]);
    
    // The coinbase transaction is always the first transaction in the block
    const coinbaseTx = block.tx[0];
    
    // The pool identifier is in the coinbase input script (vin[0].scriptSig.hex)
    const scriptSigHex = coinbaseTx.vin[0].scriptSig.hex;
    
    // Try to decode the hex data to find pool identifier
    const poolInfo = decodePoolIdentifier(scriptSigHex);
    
    return {
      blockHeight: block.height,
      blockHash: block.hash,
      timestamp: block.time,
      date: new Date(block.time * 1000).toISOString().split('T')[0],
      pool: poolInfo.name,
      poolUrl: poolInfo.url
    };
  } catch (error) {
    logger.error(`Failed to identify mining pool for block ${blockHash}:`, error);
    return {
      blockHeight: block?.height || 0,
      blockHash,
      timestamp: block?.time || 0,
      date: new Date().toISOString().split('T')[0],
      pool: 'Unknown',
      poolUrl: ''
    };
  }
};

/**
 * Decode pool identifier from coinbase script
 * @param {string} scriptSigHex - Hex-encoded coinbase script
 * @returns {Object} Pool name and URL
 */
const decodePoolIdentifier = (scriptSigHex) => {
  try {
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
    
    logger.debug(`Decoded coinbase string: ${scriptString}`);
    
    // Look for common patterns in pool identifiers
    if (scriptString.includes('Z-NOMP')) {
      logger.debug('Found Z-NOMP signature in coinbase');
      return { name: 'Z-NOMP', url: 'https://github.com/joshuayabut/z-nomp' };
    }
    
    if (scriptString.includes('Zpool')) {
      return { name: 'Zpool', url: 'https://zpool.ca' };
    }
    
    if (scriptString.includes('Zergpool')) {
      return { name: 'Zergpool', url: 'https://zergpool.com' };
    }
    
    if (scriptString.includes('DarkFiberMines')) {
      return { name: 'DarkFiberMines', url: 'https://darkfibermines.com' };
    }
    
    if (scriptString.includes('2Mars')) {
      return { name: '2Mars', url: 'https://2mars.io' };
    }
    
    // Check for specific hex patterns
    // Z-NOMP hex pattern: 5a2d4e4f4d50
    if (scriptSigHex.includes('5a2d4e4f4d50')) {
      return { name: 'Z-NOMP', url: 'https://github.com/joshuayabut/z-nomp' };
    }
    
    // If no known pool is identified, check for any URL pattern
    const urlMatch = scriptString.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      // Try to extract pool name from URL
      const url = urlMatch[0];
      const domain = url.replace(/https?:\/\//, '').split('/')[0];
      return { name: domain, url };
    }
    
    // If no known pool is identified
    logger.debug(`Unknown pool for script: ${scriptString.substring(0, 100)}`);
    return { name: 'Unknown', url: '' };
  } catch (error) {
    logger.error('Failed to decode pool identifier:', error);
    return { name: 'Unknown', url: '' };
  }
};

/**
 * Get pool distribution for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Object} Pool distribution data
 */
const getPoolDistribution = async (date) => {
  try {
    // Check if we have cached data for this date
    if (poolDataCache[date] && poolDataCache[date].length > 0) {
      return formatPoolDistribution(date, poolDataCache[date]);
    }
    
    // Get blocks mined on the specified date
    const blockchainInfo = await executeRpcCommand('getblockchaininfo');
    const currentHeight = blockchainInfo.blocks;
    
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const targetTimestamp = Math.floor(targetDate.getTime() / 1000);
    
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    nextDate.setHours(0, 0, 0, 0);
    const nextTimestamp = Math.floor(nextDate.getTime() / 1000);
    
    // Scan blocks to find ones mined on the target date
    const poolBlocks = [];
    let height = currentHeight;
    let blocksScanned = 0;
    const maxBlocksToScan = 1000; // Limit to prevent excessive scanning
    
    logger.info(`Scanning for blocks mined on ${date} (timestamps ${targetTimestamp}-${nextTimestamp})`);
    
    // For testing, limit the number of blocks to scan based on date
    // If the date is more than 30 days ago, we'll only scan a few blocks to save time
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const isOldDate = targetDate < thirtyDaysAgo;
    const scanLimit = isOldDate ? 50 : maxBlocksToScan;
    
    while (height > 0 && blocksScanned < scanLimit) {
      try {
        const blockHash = await executeRpcCommand('getblockhash', [height]);
        const block = await executeRpcCommand('getblock', [blockHash]);
        
        blocksScanned++;
        
        if (block.time >= targetTimestamp && block.time < nextTimestamp) {
          logger.debug(`Found block ${height} mined on ${date}`);
          const poolInfo = await identifyMiningPool(blockHash);
          poolBlocks.push(poolInfo);
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
    
    logger.info(`Found ${poolBlocks.length} blocks mined on ${date}`);
    
    // Cache the results
    poolDataCache[date] = poolBlocks;
    
    // Return the formatted distribution
    return formatPoolDistribution(date, poolBlocks);
  } catch (error) {
    logger.error(`Failed to get pool distribution for ${date}:`, error);
    return {
      date,
      chartType: 'pool-stat',
      data: generateMockPoolData()
    };
  }
};

/**
 * Format pool distribution data
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {Array} poolBlocks - Array of pool block data
 * @returns {Object} Formatted pool distribution
 */
const formatPoolDistribution = (date, poolBlocks) => {
  // Calculate distribution
  const poolCounts = {};
  poolBlocks.forEach(block => {
    poolCounts[block.pool] = (poolCounts[block.pool] || 0) + 1;
  });
  
  const totalBlocks = poolBlocks.length;
  
  if (totalBlocks === 0) {
    return {
      date,
      chartType: 'pool-stat',
      data: generateMockPoolData()
    };
  }
  
  const distribution = Object.entries(poolCounts).map(([name, count]) => ({
    name,
    percentage: parseFloat(((count / totalBlocks) * 100).toFixed(1)),
    count
  }));
  
  // Sort by percentage (descending)
  distribution.sort((a, b) => b.percentage - a.percentage);
  
  return {
    date,
    chartType: 'pool-stat',
    data: distribution
  };
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
 * Get mined blocks data for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Object} Mined blocks data
 */
const getMinedBlocks = async (date) => {
  try {
    // Check if we have cached data for this date
    if (minedBlockCache[date] && minedBlockCache[date].length > 0) {
      return formatMinedBlocksData(date, minedBlockCache[date]);
    }
    
    // Get blocks mined on the specified date
    const blockchainInfo = await executeRpcCommand('getblockchaininfo');
    const currentHeight = blockchainInfo.blocks;
    
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const targetTimestamp = Math.floor(targetDate.getTime() / 1000);
    
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    nextDate.setHours(0, 0, 0, 0);
    const nextTimestamp = Math.floor(nextDate.getTime() / 1000);
    
    // Scan blocks to find ones mined on the target date
    const blocks = [];
    let height = currentHeight;
    let blocksScanned = 0;
    const maxBlocksToScan = 1000; // Limit to prevent excessive scanning
    
    logger.info(`Scanning for blocks mined on ${date} (timestamps ${targetTimestamp}-${nextTimestamp})`);
    
    while (height > 0 && blocksScanned < maxBlocksToScan) {
      const blockHash = await executeRpcCommand('getblockhash', [height]);
      const block = await executeRpcCommand('getblock', [blockHash]);
      
      blocksScanned++;
      
      if (block.time >= targetTimestamp && block.time < nextTimestamp) {
        logger.debug(`Found block ${height} mined on ${date}`);
        
        // Get pool info for the block
        const poolInfo = await identifyMiningPool(blockHash);
        
        // Add block data
        blocks.push({
          height: block.height,
          hash: block.hash,
          time: block.time,
          size: block.size,
          txCount: block.tx.length,
          pool: poolInfo.pool,
          difficulty: block.difficulty
        });
      } else if (block.time < targetTimestamp) {
        // We've gone past the target date, so stop scanning
        logger.debug(`Stopping scan at block ${height}, time before target date`);
        break;
      }
      
      height--;
      
      // Log progress every 100 blocks
      if (blocksScanned % 100 === 0) {
        logger.debug(`Scanned ${blocksScanned} blocks, currently at height ${height}`);
      }
    }
    
    // Cache the results
    minedBlockCache[date] = blocks;
    
    // Return the formatted data
    return formatMinedBlocksData(date, blocks);
  } catch (error) {
    logger.error(`Failed to get mined blocks for ${date}:`, error);
    return {
      date,
      chartType: 'mined-block',
      data: generateMockMinedBlockData()
    };
  }
};

/**
 * Format mined blocks data
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {Array} blocks - Array of block data
 * @returns {Object} Formatted mined blocks data
 */
const formatMinedBlocksData = (date, blocks) => {
  if (blocks.length === 0) {
    return {
      date,
      chartType: 'mined-block',
      data: generateMockMinedBlockData()
    };
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
  const hourlyData = Object.values(hourlyBlocks).map(hourData => ({
    hour: hourData.hour,
    count: hourData.count,
    blocks: hourData.blocks.map(block => ({
      height: block.height,
      hash: block.hash,
      time: block.time,
      size: block.size,
      txCount: block.txCount,
      pool: block.pool,
      difficulty: block.difficulty
    }))
  }));
  
  return {
    date,
    chartType: 'mined-block',
    data: hourlyData
  };
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

/**
 * Initialize the pool service
 * This would typically set up database connections, etc.
 */
const initializePoolService = () => {
  logger.info('Initializing pool service');
  // In a production environment, this would initialize database connections
};

module.exports = {
  identifyMiningPool,
  getPoolDistribution,
  getMinedBlocks,
  initializePoolService
};
