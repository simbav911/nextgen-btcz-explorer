const express = require('express');
const router = express.Router();
const axios = require('axios');
const bitcoinzService = require('../services/bitcoinzService');
const logger = require('../utils/logger');
const cache = require('../utils/cache');

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
const PRICE_CACHE_TTL_MS = 60000;

// Price is cached for a minute (it used to be fetched from CoinGecko on every
// request, which is also subject to CoinGecko's rate limits). Failed lookups
// (null) are retried on the next request.
async function getBitcoinZPrice() {
  const price = await cache.wrap('coingecko:btcz', PRICE_CACHE_TTL_MS, async () => {
    const result = await fetchBitcoinZPrice();
    return result === null ? undefined : result; // undefined = don't cache
  });
  return price === undefined ? null : price;
}

// Helper function to fetch BTCZ price from CoinGecko
async function fetchBitcoinZPrice() {
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
    const [networkStats, priceData] = await Promise.all([
      bitcoinzService.getNetworkStats(),
      getBitcoinZPrice()
    ]);

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

    const fetched = await Promise.all(Array.from({ length: blockCountToFetch }, (_, i) =>
      bitcoinzService.getBlockByHeight(latestBlockHeight - i, 1) // verbosity 1 for basic info
        .catch(blockError => {
          logger.warn(`Could not fetch block at height ${latestBlockHeight - i}: ${blockError.message}`);
          // Continue if a single block fetch fails
          return null;
        })
    ));
    for (const block of fetched) {
      if (block) {
        latestBlocksData.push({
          height: block.height,
          hash: block.hash,
          time: block.time,
          txCount: block.tx ? block.tx.length : 0,
        });
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
