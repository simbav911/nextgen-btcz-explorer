const express = require('express');
const router = express.Router();
const { getNetworkStats, getBlockchainInfo } = require('../services/bitcoinzService');
const { getStatistics: getStatisticsModel } = require('../models');
const logger = require('../utils/logger');
const chartStats = require('../services/chartStatsService');

// Get current network statistics
router.get('/', async (req, res, next) => {
  try {
    logger.info('Fetching network statistics');
    
    // Get the latest network stats directly from node
    const stats = await getNetworkStats();
    
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching network statistics:', error);
    next(error);
  }
});

// Get historical statistics, aggregated from the blocks table per UTC day
// (or per hour for days <= 2 or interval=hour), oldest first; the last entry
// is the current, incomplete day/hour. hashrate is in Sol/s, derived from the
// work (difficulty) done over the period; transactions includes coinbase.
router.get('/historical', async (req, res, next) => {
  try {
    res.json(await chartStats.getHistorical(req.query));
  } catch (error) {
    logger.error('Error fetching historical statistics:', error);
    next(error);
  }
});

// Get blockchain info
router.get('/blockchain', async (req, res, next) => {
  try {
    logger.info('Fetching blockchain info');
    const info = await getBlockchainInfo();
    res.json(info);
  } catch (error) {
    logger.error('Error fetching blockchain info:', error);
    next(error);
  }
});

module.exports = router;
