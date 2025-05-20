const express = require('express');
const router = express.Router();
const { getTotalSupply } = require('../services/wealthService'); // Import from wealthService
const logger = require('../utils/logger');

// Endpoint to get total and max supply for CMC
router.get('/supply', async (req, res) => {
  try {
    // Max supply for BitcoinZ is 21 billion
    const maxSupply = 21000000000;

    // Use the existing getTotalSupply function from wealthService
    const totalSupply = await getTotalSupply();

    if (totalSupply === undefined || totalSupply === null || totalSupply === 21000000) { // Check if it returned default max supply due to an error
      logger.error('Failed to retrieve accurate total supply using wealthService.getTotalSupply().');
      // Attempt to get blockchainInfo for more detailed error logging if wealthService failed
      try {
        const bitcoinzService = require('../services/bitcoinzService');
        const blockchainInfo = await bitcoinzService.getBlockchainInfo();
        logger.info('Blockchain Info (fallback check for CMC supply):', JSON.stringify(blockchainInfo, null, 2));
        const availableKeys = blockchainInfo ? Object.keys(blockchainInfo).join(', ') : 'N/A';
        return res.status(500).json({ error: `Could not retrieve accurate total supply. wealthService.getTotalSupply() might have failed. Available keys in blockchainInfo: ${availableKeys}` });
      } catch (infoError) {
        logger.error('Additionally failed to get blockchainInfo for detailed error reporting:', infoError.message);
        return res.status(500).json({ error: 'Could not retrieve accurate total supply and failed to get detailed blockchain info.' });
      }
    }

    logger.info(`Successfully retrieved total supply for CMC: ${totalSupply}`);

    res.json({
      totalSupply: totalSupply,
      maxSupply: maxSupply,
    });
  } catch (error) {
    logger.error('Error fetching supply for CMC:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch supply data due to an internal error.' });
  }
});

module.exports = router;
