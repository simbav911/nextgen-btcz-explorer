const axios = require('axios');

// RPC credentials provided
const rpcOptions = {
  host: '127.0.0.1',
  port: 1978,
  user: '2a629aa93a1847',
  pass: 'ca3bd775e7722cf2a9babab65d4ad',
  protocol: 'http'
};

const rpcClient = {
  url: `${rpcOptions.protocol}://${rpcOptions.host}:${rpcOptions.port}`,
  auth: {
    username: rpcOptions.user,
    password: rpcOptions.pass
  }
};

/**
 * Execute an RPC command to the BitcoinZ node
 */
const executeRpcCommand = async (method, params = [], timeout = 30000) => {
  try {
    const response = await axios({
      method: 'post',
      url: rpcClient.url,
      auth: rpcClient.auth,
      data: {
        jsonrpc: '1.0',
        id: Date.now(),
        method,
        params
      },
      timeout
    });

    if (response.data.error) {
      throw new Error(`RPC Error: ${response.data.error.message}`);
    }

    return response.data.result;
  } catch (error) {
    console.error(`Error executing RPC command ${method}:`, error.message);
    throw error;
  }
};

/**
 * Get block by height
 */
const getBlockByHeight = async (height, verbosity = 1) => {
  try {
    const hash = await executeRpcCommand('getblockhash', [height]);
    return executeRpcCommand('getblock', [hash, verbosity]);
  } catch (error) {
    console.error(`Failed to get block at height ${height}:`, error.message);
    throw error;
  }
};

/**
 * Get raw transaction details
 */
const getRawTransaction = async (txid, verbose = 1) => {
  try {
    return executeRpcCommand('getrawtransaction', [txid, verbose]);
  } catch (error) {
    console.error(`Failed to get raw transaction ${txid}:`, error.message);
    throw error;
  }
};

/**
 * Extract text from coinbase transaction
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
    console.error('Error extracting coinbase text:', error);
    return '';
  }
};

/**
 * Identify mining pool from coinbase text
 */
const identifyPool = (coinbaseText) => {
  if (!coinbaseText) return 'Unknown';
  
  console.log('Coinbase text:', coinbaseText);
  
  // Check for common pool signatures
  if (coinbaseText.includes('zergpool')) return 'Zergpool';
  if (coinbaseText.includes('zpool')) return 'Zpool';
  if (coinbaseText.includes('z-nomp')) return 'Z-NOMP';
  if (coinbaseText.includes('darkfibermines')) return 'DarkFiberMines';
  if (coinbaseText.includes('2mars')) return '2Mars';
  if (coinbaseText.includes('nicehash')) return 'NiceHash';
  
  // Additional heuristics for pool identification
  if (coinbaseText.includes('/btcz/')) return 'BitcoinZ Pool';
  if (coinbaseText.includes('pool.')) return coinbaseText.match(/pool\.[a-zA-Z0-9.-]+/)?.[0] || 'Unknown Pool';
  
  return 'Unknown';
};

// Test functions to get historical data
const testHistoricalData = async () => {
  try {
    // Get blockchain info
    const blockchainInfo = await executeRpcCommand('getblockchaininfo');
    console.log('Blockchain Info:', JSON.stringify(blockchainInfo, null, 2));
    
    // Calculate timestamp for April 17, 2020
    const targetDate = new Date('2020-04-17');
    const targetTimestamp = Math.floor(targetDate.getTime() / 1000);
    
    console.log(`Target date: ${targetDate.toISOString()}, timestamp: ${targetTimestamp}`);
    
    // Use binary search to find blocks from the target date
    console.log('Using binary search to find blocks from the target date...');
    
    const latestHeight = blockchainInfo.blocks;
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
        const distance = Math.abs(blockTimestamp - targetTimestamp);
        
        if (distance < closestDistance) {
          closestBlock = block;
          closestDistance = distance;
        }
        
        if (blockTimestamp < targetTimestamp) {
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      } catch (error) {
        console.error(`Error fetching block at height ${mid}:`, error.message);
        break;
      }
    }
    
    if (closestBlock) {
      const closestDate = new Date(closestBlock.time * 1000);
      console.log(`Found closest block at height ${closestBlock.height}, date: ${closestDate.toISOString()}`);
      console.log(`Time difference: ${Math.abs(closestBlock.time - targetTimestamp) / 3600} hours`);
      
      // Now search for blocks specifically on the target date
      const startOfDay = targetTimestamp;
      const endOfDay = targetTimestamp + 86400; // 24 hours
      
      console.log(`Searching for blocks between ${new Date(startOfDay * 1000).toISOString()} and ${new Date(endOfDay * 1000).toISOString()}`);
      
      // Start from the closest block and search in both directions
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
            
            if (block.time >= startOfDay && block.time < endOfDay) {
              blocksOnTargetDate.push(block);
            } else if (block.time < startOfDay) {
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
            
            if (block.time >= startOfDay && block.time < endOfDay) {
              blocksOnTargetDate.push(block);
            } else if (block.time >= endOfDay) {
              searchingForward = false;
            }
          } catch (error) {
            searchingForward = false;
          }
        }
        
        blocksChecked++;
      }
      
      console.log(`Found ${blocksOnTargetDate.length} blocks on target date`);
      
      // Process the blocks to identify mining pools
      const poolCounts = {};
      
      for (const block of blocksOnTargetDate) {
        try {
          // Get the coinbase transaction
          const coinbaseTxid = block.tx[0];
          const coinbaseTx = await getRawTransaction(coinbaseTxid, 1);
          
          // Extract and identify pool
          const coinbaseText = extractCoinbaseText(coinbaseTx);
          const poolName = identifyPool(coinbaseText);
          
          poolCounts[poolName] = (poolCounts[poolName] || 0) + 1;
          
          console.log(`Block ${block.height} mined by: ${poolName}`);
        } catch (error) {
          console.error(`Error processing block ${block.height}:`, error.message);
        }
      }
      
      // Calculate pool distribution
      const totalBlocks = blocksOnTargetDate.length;
      const poolDistribution = Object.entries(poolCounts).map(([name, count]) => {
        const percentage = parseFloat(((count / totalBlocks) * 100).toFixed(1));
        return { name, percentage, count };
      });
      
      // Sort by percentage (descending)
      poolDistribution.sort((a, b) => b.percentage - a.percentage);
      
      console.log('Pool Distribution:', poolDistribution);
    } else {
      console.log('Could not find a block close to the target date');
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
};

// Run the test
testHistoricalData().catch(console.error);
