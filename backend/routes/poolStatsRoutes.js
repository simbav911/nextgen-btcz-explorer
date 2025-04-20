const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { executeRpcCommand, getBlockByHeight, getRawTransaction } = require('../services/bitcoinzService');

// In-memory cache for pool data
const poolDataCache = {};

/**
 * Extract text from coinbase transaction
 * @param {Object} coinbaseTx - Coinbase transaction object
 * @returns {string} Extracted text from coinbase
 */
const extractCoinbaseText = (coinbaseTx) => {
  try {
    if (!coinbaseTx || !coinbaseTx.vin || !coinbaseTx.vin[0] || !coinbaseTx.vin[0].coinbase) {
      return '';
    }
    
    // Get the coinbase hex
    const coinbaseHex = coinbaseTx.vin[0].coinbase;
    
    // Convert hex to ASCII, filtering out non-printable characters
    let text = '';
    for (let i = 0; i < coinbaseHex.length; i += 2) {
      const charCode = parseInt(coinbaseHex.substr(i, 2), 16);
      if (charCode >= 32 && charCode <= 126) { // Printable ASCII range
        text += String.fromCharCode(charCode);
      }
    }
    
    return text;
  } catch (error) {
    logger.error('Error extracting coinbase text:', error);
    return '';
  }
};

/**
 * Identify mining pool from coinbase text
 * @param {string} coinbaseText - Text extracted from coinbase
 * @returns {string} Pool name or 'Unknown'
 */
const identifyPool = (coinbaseText) => {
  if (!coinbaseText) return 'Unknown';
  
  // Common patterns in coinbase text that indicate a pool
  const poolPatterns = [
    // URL patterns
    { regex: /https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, group: 1 },
    { regex: /([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\/?/i, group: 1 },
    
    // Pool name patterns
    { regex: /@([a-zA-Z0-9.-]+)/i, group: 1 },
    { regex: /pool[.:]([a-zA-Z0-9.-]+)/i, group: 1 },
    { regex: /([a-zA-Z0-9.-]+)[- ]pool/i, group: 1 },
    
    // Specific pool identifiers
    { regex: /zergpool/i, name: 'Zergpool' },
    { regex: /zpool/i, name: 'Zpool' },
    { regex: /z-?nomp/i, name: 'Z-NOMP' },
    { regex: /darkfibermines|dfm/i, name: 'DarkFiberMines' },
    { regex: /2miners/i, name: '2Miners' },
    { regex: /nicehash|nh/i, name: 'NiceHash' },
    { regex: /luxor/i, name: 'Luxor' },
    { regex: /mining-dutch/i, name: 'Mining-Dutch' },
    { regex: /suprnova/i, name: 'Suprnova' },
    { regex: /coinmine/i, name: 'Coinmine.pl' },
    { regex: /miningpoolhub|mph/i, name: 'MiningPoolHub' },
    { regex: /btcz\.fund|bitcoinz official|btczapppool|mine\.btcz\.app/i, name: 'BitcoinZ Official' },
    { regex: /solopool/i, name: 'SoloPool' },
    { regex: /equipool/i, name: 'Equipool' }
  ];
  
  // Check against known pool patterns
  for (const pattern of poolPatterns) {
    const match = coinbaseText.match(pattern.regex);
    if (match) {
      // If a specific name is provided, use it
      if (pattern.name) {
        return pattern.name;
      }
      
      // Otherwise, use the captured group as the pool name
      if (match[pattern.group]) {
        // Clean up the pool name
        let poolName = match[pattern.group];
        
        // Remove common TLDs
        poolName = poolName.replace(/\.(com|org|net|io|app|us|ca)$/, '');
        
        // Capitalize first letter of each word
        poolName = poolName.split('.').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join('.');
        
        return poolName;
      }
    }
  }
  
  // Additional heuristics for pool identification
  if (coinbaseText.includes('/btcz/')) return 'BitcoinZ Pool';
  
  // Look for any domain-like strings
  const domainMatch = coinbaseText.match(/([a-zA-Z0-9][a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}/i);
  if (domainMatch) {
    return domainMatch[0];
  }
  
  return 'Unknown';
};

/**
 * Find blocks for a specific date using binary search
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of blocks
 */
const getBlocksForDate = async (date) => {
  try {
    // Convert date to timestamp range (start and end of the day)
    const targetDate = new Date(date);
    const startTimestamp = Math.floor(targetDate.getTime() / 1000);
    const endTimestamp = startTimestamp + 86400; // 24 hours
    
    // Get current blockchain info to determine latest block
    const blockchainInfo = await executeRpcCommand('getblockchaininfo');
    const latestHeight = blockchainInfo.blocks;
    
    logger.info(`Searching for blocks on date ${date} (timestamp ${startTimestamp}-${endTimestamp})`);
    
    // Use binary search to find a block close to the target date
    let left = 1;
    let right = latestHeight;
    let closestBlock = null;
    let closestDistance = Infinity;
    
    // Binary search to find a block close to the target timestamp
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      
      try {
        const block = await getBlockByHeight(mid);
        const blockTimestamp = block.time;
        const distance = Math.abs(blockTimestamp - startTimestamp);
        
        if (distance < closestDistance) {
          closestBlock = block;
          closestDistance = distance;
        }
        
        if (blockTimestamp < startTimestamp) {
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      } catch (error) {
        logger.error(`Error fetching block at height ${mid}:`, error.message);
        // If we can't get this block, try the next one
        left = mid + 1;
      }
    }
    
    if (!closestBlock) {
      logger.warn(`Could not find any blocks close to date ${date}`);
      return [];
    }
    
    const closestDate = new Date(closestBlock.time * 1000);
    logger.info(`Found closest block at height ${closestBlock.height}, date: ${closestDate.toISOString()}`);
    logger.info(`Time difference: ${Math.abs(closestBlock.time - startTimestamp) / 3600} hours`);
    
    // Now search for blocks specifically on the target date
    const blocksOnTargetDate = [];
    let currentHeight = closestBlock.height;
    let searchingBackward = true;
    let searchingForward = true;
    const MAX_BLOCKS_TO_CHECK = 5000;
    let blocksChecked = 0;
    
    while ((searchingBackward || searchingForward) && blocksChecked < MAX_BLOCKS_TO_CHECK) {
      // Search backward
      if (searchingBackward) {
        try {
          const block = await getBlockByHeight(currentHeight - blocksChecked);
          
          if (block.time >= startTimestamp && block.time < endTimestamp) {
            blocksOnTargetDate.push(block);
          } else if (block.time < startTimestamp) {
            searchingBackward = false;
          }
        } catch (error) {
          searchingBackward = false;
        }
      }
      
      // Search forward
      if (searchingForward) {
        try {
          const block = await getBlockByHeight(currentHeight + blocksChecked);
          
          if (block.time >= startTimestamp && block.time < endTimestamp) {
            blocksOnTargetDate.push(block);
          } else if (block.time >= endTimestamp) {
            searchingForward = false;
          }
        } catch (error) {
          searchingForward = false;
        }
      }
      
      blocksChecked++;
    }
    
    logger.info(`Found ${blocksOnTargetDate.length} blocks for date ${date} after checking ${blocksChecked} blocks`);
    return blocksOnTargetDate;
  } catch (error) {
    logger.error(`Failed to get blocks for date ${date}:`, error);
    throw error;
  }
};

/**
 * Get real pool distribution data for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Array>} Pool distribution data
 */
const getRealPoolDistribution = async (date) => {
  try {
    // Check if we have cached data for this date
    if (poolDataCache[date]) {
      logger.info(`Using cached pool data for ${date}`);
      return poolDataCache[date];
    }
    
    logger.info(`Getting real pool distribution for date: ${date}`);
    
    // Get blocks for the specified date using binary search
    const blocks = await getBlocksForDate(date);
    
    if (blocks.length === 0) {
      logger.warn(`No blocks found for date ${date}`);
      
      // Try to find the earliest block to provide better feedback
      try {
        const blockchainInfo = await executeRpcCommand('getblockchaininfo');
        const latestHeight = blockchainInfo.blocks;
        
        // Try to get the earliest block (height 1)
        const earliestBlock = await getBlockByHeight(1);
        const earliestDate = new Date(earliestBlock.time * 1000);
        
        logger.info(`Earliest available block is at height 1, date: ${earliestDate.toISOString().split('T')[0]}`);
        
        return [{ 
          name: `No Data Available - Blockchain data starts from ${earliestDate.toISOString().split('T')[0]}`, 
          percentage: 100, 
          count: 0 
        }];
      } catch (error) {
        logger.error('Error finding earliest block:', error);
        return [{ name: 'No Data Available', percentage: 100, count: 0 }];
      }
    }
    
    // Process blocks to identify mining pools
    const poolCounts = {};
    let unknownCount = 0;
    const coinbaseTextSamples = {}; // Store samples of coinbase text for unknown pools
    
    for (const block of blocks) {
      try {
        // Get the coinbase transaction (first transaction in the block)
        const coinbaseTxid = block.tx[0];
        const coinbaseTx = await getRawTransaction(coinbaseTxid, 1);
        
        // Extract text from coinbase and identify the pool
        const coinbaseText = extractCoinbaseText(coinbaseTx);
        const poolName = identifyPool(coinbaseText);
        
        if (poolName === 'Unknown') {
          unknownCount++;
          // Store a sample of the coinbase text for unknown pools
          if (!coinbaseTextSamples[coinbaseText] && Object.keys(coinbaseTextSamples).length < 10) {
            coinbaseTextSamples[coinbaseText] = block.height;
          }
          logger.debug(`Block ${block.height}: Unknown pool, coinbase text: ${coinbaseText.substring(0, 100)}`);
        } else {
          logger.debug(`Block ${block.height}: Identified pool ${poolName}`);
        }
        
        // Increment pool count
        poolCounts[poolName] = (poolCounts[poolName] || 0) + 1;
      } catch (error) {
        logger.error(`Error processing block ${block.hash}:`, error);
      }
    }
    
    // Log unknown percentage for debugging
    const unknownPercentage = (unknownCount / blocks.length) * 100;
    logger.info(`Unknown pools: ${unknownCount}/${blocks.length} (${unknownPercentage.toFixed(1)}%)`);
    
    // Log samples of unknown coinbase texts to help identify new pools
    if (unknownCount > 0) {
      logger.info('Samples of unknown coinbase texts:');
      for (const [text, height] of Object.entries(coinbaseTextSamples)) {
        logger.info(`Block ${height}: ${text.substring(0, 100)}`);
      }
    }
    
    // Convert pool counts to distribution data
    const totalBlocks = blocks.length;
    const poolDistribution = Object.entries(poolCounts).map(([name, count]) => {
      const percentage = parseFloat(((count / totalBlocks) * 100).toFixed(1));
      return { name, percentage, count };
    });
    
    // Sort by percentage (descending)
    poolDistribution.sort((a, b) => b.percentage - a.percentage);
    
    // Cache the results
    poolDataCache[date] = poolDistribution;
    
    return poolDistribution;
  } catch (error) {
    logger.error(`Failed to get real pool distribution for ${date}:`, error);
    return [{ name: 'Error retrieving data', percentage: 100, count: 0 }];
  }
};

// Endpoint for real pool distribution data
router.get('/real-pool-stat', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    
    logger.info(`REAL-POOL-STAT endpoint hit for date: ${date}`);
    
    // Get real pool distribution from blockchain data
    const poolDistribution = await getRealPoolDistribution(date);
    
    // Format response
    const data = {
      date,
      chartType: 'pool-stat',
      data: poolDistribution
    };
    
    return res.json(data);
  } catch (error) {
    logger.error('Error in real-pool-stat endpoint:', error);
    return res.status(500).json({
      error: 'An unexpected error occurred',
      message: error.message
    });
  }
});

module.exports = router;
