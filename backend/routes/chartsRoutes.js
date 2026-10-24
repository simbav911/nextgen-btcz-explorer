const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { executeRpcCommand, getBlockchainInfo } = require('../services/bitcoinzService');
const { getSequelize } = require('../db');
const { createBoundedMap } = require('../utils/cache');
const chartStats = require('../services/chartStatsService');

// Warm the chart rollup in the background
chartStats.start();

// In-memory cache for chart data (date -> data). Bounded, because the date
// comes straight from the query string; days that are not over yet expire.
const chartDataCache = {
  'pool-stat': createBoundedMap(100),
  'mined-block': createBoundedMap(100)
};
const OPEN_DAY_TTL_MS = 5 * 60 * 1000;
const cacheTtlForDate = (date) => {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  const t = next.getTime();
  return (isNaN(t) || t > Date.now()) ? OPEN_DAY_TTL_MS : Infinity;
};

/**
 * Identify the mining pool from a coinbase transaction
 * @param {Object} coinbaseTx - Coinbase transaction object
 * @returns {string} Pool name
 */
const identifyMiningPool = (coinbaseTx) => {
  try {
    // The pool identifier is in the coinbase input script. Coinbase inputs
    // from bitcoinzd carry `coinbase` and no `scriptSig`, which used to throw
    // (and log an error per block) before returning 'Unknown' anyway.
    if (!coinbaseTx || !coinbaseTx.vin || !coinbaseTx.vin[0] || !coinbaseTx.vin[0].scriptSig) {
      return 'Unknown';
    }
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
    const blockchainInfo = await getBlockchainInfo();
    const currentHeight = blockchainInfo.blocks;
    
    // Calculate target date timestamps
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const targetTimestamp = Math.floor(targetDate.getTime() / 1000);
    
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    nextDate.setHours(0, 0, 0, 0);
    const nextTimestamp = Math.floor(nextDate.getTime() / 1000);

    // An unparseable date matches no block (the scan below used to walk all
    // `maxBlocks` blocks via RPC before returning nothing)
    if (isNaN(targetTimestamp) || isNaN(nextTimestamp)) {
      logger.info(`Invalid date ${date}, no blocks to scan`);
      return [];
    }
    
    logger.info(`Scanning for blocks mined on ${date} (timestamps ${targetTimestamp}-${nextTimestamp})`);
    
    // For testing, limit the number of blocks to scan based on date
    // If the date is more than 30 days ago, we'll only scan a few blocks to save time
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const isOldDate = targetDate < thirtyDaysAgo;
    const scanLimit = isOldDate ? 50 : maxBlocks;
    const lowestHeight = Math.max(1, currentHeight - scanLimit + 1);

    // Same scan as before (newest block first, stop at the first block older
    // than the target day), but reading block headers and coinbase inputs from
    // the indexed DB in two queries instead of 2-3 RPC calls per block.
    const dbBlocks = new Map();
    const sequelize = getSequelize();
    if (sequelize) {
      try {
        const [rows] = await sequelize.query(
          `SELECT height, hash, time, size, cardinality(tx) AS "txCount", difficulty, tx[1] AS "coinbaseTxid"
           FROM blocks WHERE height BETWEEN $1 AND $2`,
          { bind: [lowestHeight, currentHeight] }
        );
        for (const r of rows) dbBlocks.set(r.height, r);
      } catch (dbError) {
        logger.warn(`DB block scan failed, using RPC: ${dbError.message}`);
      }
    }

    const blocks = [];
    const matched = [];
    for (let height = currentHeight; height >= lowestHeight && height > 0; height--) {
      try {
        let block = dbBlocks.get(height);
        if (!block) {
          const blockHash = await executeRpcCommand('getblockhash', [height]);
          const rpcBlock = await executeRpcCommand('getblock', [blockHash]);
          block = {
            height: rpcBlock.height,
            hash: rpcBlock.hash,
            time: rpcBlock.time,
            size: rpcBlock.size,
            txCount: rpcBlock.tx.length,
            difficulty: rpcBlock.difficulty,
            coinbaseTxid: rpcBlock.tx[0]
          };
        }

        if (block.time >= targetTimestamp && block.time < nextTimestamp) {
          matched.push(block);
        } else if (block.time < targetTimestamp) {
          // We've gone past the target date, so stop scanning
          logger.debug(`Stopping scan at block ${height}, time before target date`);
          break;
        }
      } catch (error) {
        logger.error(`Error scanning block at height ${height}:`, error);
      }
    }

    // Coinbase inputs of the matching blocks (DB first, RPC for misses)
    const coinbaseVins = new Map();
    if (sequelize && matched.length > 0) {
      try {
        const [rows] = await sequelize.query(
          'SELECT txid, vin FROM transactions WHERE txid = ANY($1::varchar[])',
          { bind: [matched.map(b => b.coinbaseTxid)] }
        );
        for (const r of rows) coinbaseVins.set(r.txid, r.vin);
      } catch (dbError) {
        logger.warn(`DB coinbase lookup failed, using RPC: ${dbError.message}`);
      }
    }

    for (const block of matched) {
      let coinbaseTx;
      const vin = coinbaseVins.get(block.coinbaseTxid);
      if (vin) {
        coinbaseTx = { txid: block.coinbaseTxid, vin };
      } else {
        // Get full block with transaction data
        const fullBlock = await executeRpcCommand('getblock', [block.hash, 2]);
        coinbaseTx = fullBlock.tx[0];
      }

      // Identify the mining pool
      const pool = identifyMiningPool(coinbaseTx);

      blocks.push({
        height: block.height,
        hash: block.hash,
        time: block.time,
        size: block.size,
        txCount: block.txCount,
        pool,
        difficulty: block.difficulty
      });
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

// Block size / interval / difficulty / mining revenue: real data aggregated
// per time bucket from the blocks and transactions tables (see
// services/chartStatsService.js). Query: days (1, 7, 30, 90, 365; >= 3000
// means all time) and date (YYYY-MM-DD start day, used for past custom days).
// Each point has blockHeight (last block in the bucket), timestamp (time of
// that block), date and the chart's value; points are ordered oldest first.
const seriesRoute = (chartType, pick) => async (req, res) => {
  try {
    const series = await chartStats.getSeries(req.query);
    const days = parseInt(req.query.days, 10) || 30;
    return res.json({
      days,
      chartType,
      from: new Date(series.from * 1000).toISOString(),
      to: new Date(series.to * 1000).toISOString(),
      bucketSeconds: series.bucketSeconds,
      ...(chartType === 'mining-revenue' ? { partial: series.partial } : {}),
      data: series.points.map((p) => ({
        blockHeight: p.blockHeight,
        timestamp: new Date(p.lastBlockTime * 1000).toISOString(),
        date: new Date(p.lastBlockTime * 1000).toISOString().split('T')[0],
        blocks: p.blocks,
        ...pick(p)
      }))
    });
  } catch (error) {
    logger.error(`Error in ${chartType} endpoint: ${error.message}`);
    return res.status(500).json({
      error: 'An unexpected error occurred',
      message: error.message
    });
  }
};

// Average block size (bytes) per bucket
router.get('/block-size', seriesRoute('block-size', (p) => ({ blockSize: p.blockSize })));

// Average block interval (seconds) per bucket
router.get('/block-interval', seriesRoute('block-interval', (p) => ({ interval: p.interval })));

// Average difficulty per bucket
router.get('/difficulty', seriesRoute('difficulty', (p) => ({ difficulty: p.difficulty })));

// Total coinbase output (block subsidy incl. fund outputs + fees, BTCZ) per
// bucket; null while that period's coinbase data is still being loaded
router.get('/mining-revenue', seriesRoute('mining-revenue', (p) => ({ revenue: p.revenue })));

// Pool stat chart data
router.get('/pool-stat', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    
    logger.info(`NEW IMPLEMENTATION: Pool-stat endpoint hit for date: ${date}`);
    
    // Check if we have cached data for this date
    const cachedPoolStat = chartDataCache['pool-stat'].get(date);
    if (cachedPoolStat) {
      logger.info(`Returning cached pool-stat data for ${date}`);
      return res.json(cachedPoolStat);
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
    chartDataCache['pool-stat'].set(date, data, cacheTtlForDate(date));
    
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
    const cachedMinedBlock = chartDataCache['mined-block'].get(date);
    if (cachedMinedBlock) {
      logger.info(`Returning cached mined-block data for ${date}`);
      return res.json(cachedMinedBlock);
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
    chartDataCache['mined-block'].set(date, data, cacheTtlForDate(date));
    
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
