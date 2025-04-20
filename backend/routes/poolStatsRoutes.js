const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { executeRpcCommand, getBlockByHeight, getRawTransaction } = require('../services/bitcoinzService');

// In-memory cache for pool data
const poolDataCache = {};

// Cache for pool signatures to avoid repeating the same detection work
const poolSignatureCache = {};

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
 * Extract BitcoinZ address from coinbase transaction
 * @param {Object} coinbaseTx - Coinbase transaction object
 * @returns {string|null} BitcoinZ address or null if not found
 */
const extractBitcoinZAddress = (coinbaseTx) => {
  try {
    // Check if the transaction has vout (outputs)
    if (!coinbaseTx.vout || !Array.isArray(coinbaseTx.vout) || coinbaseTx.vout.length === 0) {
      return null;
    }
    
    // Look for scriptPubKey with addresses
    for (const vout of coinbaseTx.vout) {
      if (vout.scriptPubKey && vout.scriptPubKey.addresses && vout.scriptPubKey.addresses.length > 0) {
        // Return the first BitcoinZ address (usually the miner's address)
        return vout.scriptPubKey.addresses[0];
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Error extracting BitcoinZ address:', error);
    return null;
  }
};

/**
 * Extract pool information from coinbase text using pattern recognition
 * @param {string} coinbaseText - Text extracted from coinbase transaction
 * @returns {string|null} Pool name or null if not detected
 */
const extractPoolFromText = (coinbaseText) => {
  if (!coinbaseText) return null;
  
  // Common patterns to extract pool information - these are just pattern recognition
  // techniques, not hard-coded pool names
  const patterns = [
    // URL patterns
    { regex: /https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, group: 1 },
    { regex: /([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\/?/i, group: 1 },
    
    // Common pool naming patterns
    { regex: /([a-zA-Z0-9.-]+)[- ]pool/i, group: 1 },
    { regex: /pool[.:]([a-zA-Z0-9.-]+)/i, group: 1 },
    { regex: /pool[- ]?([a-zA-Z0-9.-]+)/i, group: 1 },
    { regex: /([a-zA-Z0-9.-]+)[- ]?miner/i, group: 1 },
    { regex: /mined[- ]by[- ]([a-zA-Z0-9.-]+)/i, group: 1 },
    
    // Extract anything that looks like a service name
    { regex: /^([a-zA-Z0-9][a-zA-Z0-9.-]{2,})$/i, group: 1 },
  ];
  
  // Try to extract pool name using patterns
  for (const pattern of patterns) {
    const match = coinbaseText.match(pattern.regex);
    if (match && match[pattern.group]) {
      // Clean up the pool name
      let poolName = match[pattern.group];
      
      // Remove common TLDs
      poolName = poolName.replace(/\.(com|org|net|io|app|us|ca)$/, '');
      
      return poolName;
    }
  }
  
  return null;
};

/**
 * Identify mining pool from coinbase text and transaction
 * @param {string} coinbaseText - Text extracted from coinbase transaction
 * @param {Object} coinbaseTx - Full coinbase transaction object (optional)
 * @returns {Object} Pool information with name and address (if available)
 */
const identifyPool = (coinbaseText, coinbaseTx = null) => {
  // Check if we've already identified this signature
  if (poolSignatureCache[coinbaseText]) {
    return poolSignatureCache[coinbaseText];
  }
  
  let poolName = 'Unknown';
  let address = null;
  
  // Try to extract BitcoinZ address for unknown pools
  if (coinbaseTx) {
    address = extractBitcoinZAddress(coinbaseTx);
  }
  
  // Try to extract pool name from coinbase text
  const extractedPool = extractPoolFromText(coinbaseText);
  if (extractedPool) {
    // Format the pool name properly - just capitalize first letter if needed
    poolName = extractedPool.charAt(0).toUpperCase() + extractedPool.slice(1);
  } else if (address) {
    // If we couldn't extract a pool name but have an address, use that
    poolName = `Unknown (${address})`;
  }
  
  // Cache the result
  const result = { name: poolName, address };
  poolSignatureCache[coinbaseText] = result;
  
  return result;
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
    const unknownPoolAddresses = {}; // Track addresses of unknown pools
    const poolSignatures = {}; // Track coinbase signatures by pool
    
    // Store coinbase texts for each pool to analyze patterns
    const poolCoinbaseTexts = {};
    
    for (const block of blocks) {
      try {
        // Get the coinbase transaction (first transaction in the block)
        const coinbaseTxid = block.tx[0];
        const coinbaseTx = await getRawTransaction(coinbaseTxid, 1);
        
        // Extract text from coinbase and identify the pool
        const coinbaseText = extractCoinbaseText(coinbaseTx);
        const poolInfo = identifyPool(coinbaseText, coinbaseTx);
        const poolName = poolInfo.name;
        
        // Store coinbase text for this pool for pattern analysis
        if (!poolCoinbaseTexts[poolName]) {
          poolCoinbaseTexts[poolName] = [];
        }
        if (!poolCoinbaseTexts[poolName].includes(coinbaseText)) {
          poolCoinbaseTexts[poolName].push(coinbaseText);
        }
        
        // Store coinbase signature for this pool for future analysis
        if (!poolSignatures[poolName]) {
          poolSignatures[poolName] = [];
        }
        if (!poolSignatures[poolName].includes(coinbaseText) && poolSignatures[poolName].length < 5) {
          poolSignatures[poolName].push(coinbaseText);
        }
        
        if (poolName.startsWith('Unknown')) {
          unknownCount++;
          
          // Store the address for unknown pools
          if (poolInfo.address) {
            unknownPoolAddresses[poolInfo.address] = (unknownPoolAddresses[poolInfo.address] || 0) + 1;
          }
          
          // Store a sample of the coinbase text for unknown pools
          if (!coinbaseTextSamples[coinbaseText] && Object.keys(coinbaseTextSamples).length < 10) {
            coinbaseTextSamples[coinbaseText] = block.height;
          }
          logger.debug(`Block ${block.height}: ${poolName}, coinbase text: ${coinbaseText.substring(0, 100)}`);
        } else {
          logger.debug(`Block ${block.height}: Identified pool ${poolName}`);
        }
        
        // Increment pool count
        poolCounts[poolName] = (poolCounts[poolName] || 0) + 1;
      } catch (error) {
        logger.error(`Error processing block ${block.hash}:`, error);
      }
    }
    
    // Analyze pool coinbase texts to find patterns and potentially refine pool names
    // This is where we could detect regional information or other patterns
    Object.entries(poolCoinbaseTexts).forEach(([poolName, texts]) => {
      if (poolName.toLowerCase().includes('equipool') && texts.length > 0) {
        // Look for regional patterns in the coinbase texts
        const regions = {
          'North America': 0,
          'Asia': 0,
          'Europe': 0
        };
        
        texts.forEach(text => {
          const lowerText = text.toLowerCase();
          if (lowerText.includes('north') || lowerText.includes('america') || 
              lowerText.includes('na') || lowerText.includes('us') || 
              lowerText.includes('usa') || lowerText.includes('canada')) {
            regions['North America']++;
          } else if (lowerText.includes('asia') || lowerText.includes('jp') || 
                     lowerText.includes('cn') || lowerText.includes('kr') || 
                     lowerText.includes('hk')) {
            regions['Asia']++;
          } else if (lowerText.includes('europe') || lowerText.includes('eu') || 
                     lowerText.includes('uk') || lowerText.includes('de') || 
                     lowerText.includes('fr')) {
            regions['Europe']++;
          }
        });
        
        // Find the most common region
        const entries = Object.entries(regions);
        const mostCommonRegion = entries.reduce((max, entry) => 
          entry[1] > max[1] ? entry : max, ['', 0]);
        
        // If we found a region with at least one mention, rename the pool
        if (mostCommonRegion[1] > 0) {
          const newPoolName = `Equipool ${mostCommonRegion[0]}`;
          
          // Transfer the count to the new pool name
          poolCounts[newPoolName] = (poolCounts[newPoolName] || 0) + poolCounts[poolName];
          delete poolCounts[poolName];
          
          logger.info(`Refined pool name from ${poolName} to ${newPoolName} based on ${mostCommonRegion[1]} mentions`);
        }
      }
    });
    
    // Log unknown percentage for debugging
    const unknownPercentage = (unknownCount / blocks.length) * 100;
    logger.info(`Unknown pools: ${unknownCount}/${blocks.length} (${unknownPercentage.toFixed(1)}%)`);
    
    // Log samples of unknown coinbase texts to help identify new pools
    if (unknownCount > 0) {
      logger.info('Samples of unknown coinbase texts:');
      for (const [text, height] of Object.entries(coinbaseTextSamples)) {
        logger.info(`Block ${height}: ${text.substring(0, 100)}`);
      }
      
      // Log addresses of unknown pools
      logger.info('Addresses of unknown pools:');
      for (const [address, count] of Object.entries(unknownPoolAddresses)) {
        logger.info(`Address ${address}: ${count} blocks (${((count / unknownCount) * 100).toFixed(1)}% of unknown)`);
      }
    }
    
    // Log pool signatures for future pattern recognition improvement
    logger.info('Pool signatures:');
    for (const [pool, signatures] of Object.entries(poolSignatures)) {
      if (signatures.length > 0) {
        logger.info(`${pool} signatures:`);
        signatures.forEach(sig => logger.info(`  - ${sig.substring(0, 100)}`));
      }
    }
    
    // Group solo miners if they have few blocks
    const soloMinersThreshold = Math.max(1, Math.floor(blocks.length * 0.005)); // 0.5% of blocks
    const soloMiners = {};
    
    // First pass: identify solo miners with few blocks
    Object.entries(poolCounts).forEach(([name, count]) => {
      if (name.startsWith('Unknown (') && count <= soloMinersThreshold) {
        soloMiners[name] = count;
        delete poolCounts[name];
      }
    });
    
    // If we have solo miners, group them
    if (Object.keys(soloMiners).length > 0) {
      const totalSoloCount = Object.values(soloMiners).reduce((sum, count) => sum + count, 0);
      poolCounts['Others solo miners'] = totalSoloCount;
      
      // Store the individual solo miners for detailed view
      poolCounts['_soloMinersDetail'] = soloMiners;
    }
    
    // Convert pool counts to distribution data
    const totalBlocks = blocks.length;
    const poolDistribution = Object.entries(poolCounts)
      .filter(([name]) => !name.startsWith('_')) // Filter out metadata
      .map(([name, count]) => {
        const percentage = parseFloat(((count / totalBlocks) * 100).toFixed(1));
        return { 
          name, 
          percentage, // This represents hashrate percentage
          count 
        };
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

/**
 * Get mined blocks data for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Array>} Mined blocks data
 */
const getMinedBlocksData = async (date) => {
  try {
    // Get blocks for the specified date using binary search
    const blocks = await getBlocksForDate(date);
    
    if (blocks.length === 0) {
      logger.warn(`No blocks found for date ${date}`);
      return [];
    }
    
    // Process blocks to identify mining pools
    const minedBlocks = [];
    
    for (const block of blocks) {
      try {
        // Get the coinbase transaction (first transaction in the block)
        const coinbaseTxid = block.tx[0];
        const coinbaseTx = await getRawTransaction(coinbaseTxid, 1);
        
        // Extract text from coinbase and identify the pool
        const coinbaseText = extractCoinbaseText(coinbaseTx);
        const poolInfo = identifyPool(coinbaseText, coinbaseTx);
        
        // Add block to the list with pool information
        minedBlocks.push({
          blockHeight: block.height,
          pool: poolInfo.name,
          size: block.size,
          timestamp: new Date(block.time * 1000).toISOString(),
          address: poolInfo.address || null
        });
      } catch (error) {
        logger.error(`Error processing block ${block.hash}:`, error);
      }
    }
    
    // Sort by block height (descending)
    minedBlocks.sort((a, b) => b.blockHeight - a.blockHeight);
    
    return minedBlocks;
  } catch (error) {
    logger.error(`Failed to get mined blocks data for ${date}:`, error);
    return [];
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

// Endpoint for mined blocks data
router.get('/mined-blocks', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const days = parseInt(req.query.days || '1', 10);
    
    logger.info(`MINED-BLOCKS endpoint hit for date: ${date}, days: ${days}`);
    
    // For multi-day requests, we need to get data for each day
    if (days > 1) {
      const allMinedBlocks = [];
      
      // Get data for each day, starting from the specified date and going back
      for (let i = 0; i < days; i++) {
        const currentDate = new Date(date);
        currentDate.setDate(currentDate.getDate() - i);
        const currentDateStr = currentDate.toISOString().split('T')[0];
        
        const dayBlocks = await getMinedBlocksData(currentDateStr);
        allMinedBlocks.push(...dayBlocks);
      }
      
      // Sort all blocks by height (descending)
      allMinedBlocks.sort((a, b) => b.blockHeight - a.blockHeight);
      
      // Format response
      const data = {
        date,
        days,
        chartType: 'mined-block',
        data: allMinedBlocks
      };
      
      return res.json(data);
    } else {
      // Single day request
      const minedBlocks = await getMinedBlocksData(date);
      
      // Format response
      const data = {
        date,
        days: 1,
        chartType: 'mined-block',
        data: minedBlocks
      };
      
      return res.json(data);
    }
  } catch (error) {
    logger.error('Error in mined-blocks endpoint:', error);
    return res.status(500).json({
      error: 'An unexpected error occurred',
      message: error.message
    });
  }
});

module.exports = router;
