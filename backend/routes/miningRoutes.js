const express = require('express');
const router = express.Router();
const axios = require('axios');
const bitcoinzService = require('../services/bitcoinzService');
const logger = require('../utils/logger');

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';

// Helper function to fetch BTCZ price from CoinGecko
async function getBitcoinZPrice() {
  try {
    const response = await axios.get(`${COINGECKO_API_URL}/simple/price`, {
      params: {
        ids: 'bitcoinz',
        vs_currencies: 'usd',
        include_24hr_change: true,
      },
      timeout: 5000, // 5 second timeout
    });
    if (response.data && response.data.bitcoinz && response.data.bitcoinz.usd !== undefined) {
      return response.data.bitcoinz;
    }
    logger.warn('BTCZ price data not found in CoinGecko response or response format unexpected.');
    return null;
  } catch (error) {
    logger.error('Error fetching BitcoinZ price from CoinGecko:', error.message);
    return null;
  }
}

// Endpoint to get mining related information
router.get('/info', async (req, res) => {
  try {
    // Get latest blocks (e.g., last 5)
    // We can reuse getLatestBlocks from bitcoinzService if it fetches detailed blocks,
    // or call getBlock for the last few block hashes.
    // For simplicity, let's get network stats which include current block height and difficulty.
    const networkStats = await bitcoinzService.getNetworkStats();
    const priceData = await getBitcoinZPrice();

    if (!networkStats || !networkStats.blockchainInfo || !networkStats.miningInfo) {
      logger.error('Failed to retrieve complete network stats for mining info.');
      return res.status(500).json({ error: 'Could not retrieve complete network statistics.' });
    }

    const latestBlockHeight = networkStats.blockchainInfo.blocks;
    const difficulty = networkStats.blockchainInfo.difficulty;
    const networkHashrate = networkStats.miningInfo.networkhashps;

    // Fetch a few latest blocks for display
    const latestBlocksData = [];
    const blockCountToFetch = Math.min(latestBlockHeight, 5); // Fetch up to 5 latest blocks

    for (let i = 0; i < blockCountToFetch; i++) {
      try {
        const block = await bitcoinzService.getBlockByHeight(latestBlockHeight - i, 1); // verbosity 1 for basic info
        if (block) {
          latestBlocksData.push({
            height: block.height,
            hash: block.hash,
            time: block.time,
            txCount: block.tx ? block.tx.length : 0,
          });
        }
      } catch (blockError) {
        logger.warn(`Could not fetch block at height ${latestBlockHeight - i}: ${blockError.message}`);
        // Continue if a single block fetch fails
      }
    }

    res.json({
      latestBlocks: latestBlocksData,
      difficulty: difficulty,
      networkHashrate: networkHashrate,
      btczPriceUSD: priceData ? priceData.usd : null,
      btczPrice24hChange: priceData ? priceData.usd_24h_change : null,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching mining info:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch mining data.' });
  }
});

module.exports = router;
