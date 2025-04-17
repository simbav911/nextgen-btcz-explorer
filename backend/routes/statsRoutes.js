const express = require('express');
const router = express.Router();
const { getNetworkStats, getBlockchainInfo } = require('../services/bitcoinzService');
const { getStatistics: getStatisticsModel } = require('../models');
const logger = require('../utils/logger');

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

// Get historical statistics
router.get('/historical', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const interval = req.query.interval || 'day';
    
    logger.info(`Fetching historical stats for ${days} days with interval ${interval}`);
    
    // Generate mock historical data for now
    // In a real implementation, this would come from the database
    const stats = [];
    const now = Date.now();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(now - (i * 86400000)); // Go back i days
      const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
      
      stats.push({
        date: dateStr,
        difficulty: 10000 - i * 10,
        hashrate: 50000000 - i * 100000,
        transactions: 100 - i,
        avgBlockTime: 150 + i
      });
    }
    
    res.json({
      interval,
      days,
      stats: stats.reverse() // Oldest to newest
    });
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
