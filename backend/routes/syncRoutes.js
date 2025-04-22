const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
// Import from the correct services
const { getLastIndexedBlock } = require('../services/indexerService');
const { getBlockchainInfo } = require('../services/bitcoinzService');

// Get current sync status
router.get('/status', async (req, res, next) => {
  try {
    logger.debug('Fetching sync status from indexerService');
    const lastSyncedBlock = getLastIndexedBlock(); // Get from indexerService
    let currentHeight = 0;
    let isSyncing = false; // We don't have an easy isSyncing flag from indexer, default to false for now

    try {
      const info = await getBlockchainInfo(); // Get current height
      currentHeight = info?.blocks || 0;
    } catch (heightError) {
      logger.warn('Could not fetch current blockchain height for sync status:', heightError.message);
    }

    res.json({
      lastSyncedBlock,
      currentHeight,
      isSyncing // Note: isSyncing might not be accurate here
    });
  } catch (error) {
    logger.error(`Error constructing sync status:`, error);
    next(error); // Pass error to the error handling middleware
  }
});

module.exports = router;