const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const wealthService = require('../services/wealthService');

// Get top holders (wealth distribution)
router.get('/top-holders', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    logger.info(`Fetching top ${limit} BitcoinZ holders`);
    
    // Get top holders from service
    const topHolders = await wealthService.getTopHolders(limit);
    const totalSupply = await wealthService.getTotalSupply();
    
    // Get total addresses count
    const distributionData = await wealthService.getDistribution();
    
    res.json({
      topHolders,
      totalAddressesAnalyzed: distributionData.totalAddresses,
      totalSupply
    });
  } catch (error) {
    logger.error(`Error fetching top holders:`, error);
    next(error);
  }
});

// Get wealth distribution by balance ranges
router.get('/distribution', async (req, res, next) => {
  try {
    logger.info('Fetching wealth distribution by balance ranges');
    
    // Get distribution data from service
    const { distribution, totalAddresses } = await wealthService.getDistribution();
    
    res.json({
      distribution,
      totalAddresses
    });
  } catch (error) {
    logger.error(`Error fetching wealth distribution:`, error);
    next(error);
  }
});

module.exports = router;
