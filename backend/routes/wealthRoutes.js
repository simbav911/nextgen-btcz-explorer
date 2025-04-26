const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const wealthService = require('../services/wealthService');

// Get top holders (wealth distribution)
router.get('/top-holders', async (req, res, next) => {
  try {
    // Force a higher limit to ensure we get all top holders - frontend can handle pagination
    const requestedLimit = parseInt(req.query.limit) || 100;
    // Use a higher limit to ensure we return at least 100 addresses
    const actualLimit = Math.max(requestedLimit, 100);
    
    logger.info(`Fetching top ${actualLimit} BitcoinZ holders (requested: ${requestedLimit})`);
    
    // Get top holders from service
    const topHolders = await wealthService.getTopHolders(actualLimit);
    const totalSupply = await wealthService.getTotalSupply();
    
    // Get total addresses count
    const distributionData = await wealthService.getDistribution();
    
    logger.info(`Returning ${topHolders.length} top holders to client`);
    
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
