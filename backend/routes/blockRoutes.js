const express = require('express');
const router = express.Router();
const bitcoinzService = require('../services/bitcoinzService'); // Keep bitcoinzService for fallbacks
const models = require('../models'); // Import the models module
const logger = require('../utils/logger');
const { Op } = require('sequelize'); // Import Op for queries if needed

// Get latest blocks (Fetch directly from Node for real-time view)
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    // Get current blockchain info to know the latest block height
    const info = await bitcoinzService.getBlockchainInfo();
    const bestHeight = info.blocks;

    logger.info(`Fetching latest blocks directly from node (height ${bestHeight}, offset ${offset}, limit ${limit})`);

    // Get blocks directly from node, starting from latest and going back
    const blocks = [];
    const fetchPromises = [];
    for (let i = 0; i < limit && (bestHeight - i - offset) >= 0; i++) {
      const height = bestHeight - i - offset;
      // Fetch blocks concurrently
      fetchPromises.push(
        bitcoinzService.getBlockByHeight(height, 1) // Verbosity 1 for list view
          .catch(err => {
            logger.error(`Error fetching block at height ${height} via RPC: ${err.message}`);
            return null; // Return null on error for this specific block
          })
      );
    }

    const results = await Promise.all(fetchPromises);
    // Filter out any null results from failed fetches
    const fetchedBlocks = results.filter(block => block !== null);

    logger.info(`Fetched ${fetchedBlocks.length} blocks via RPC`);

    res.json({
      blocks: fetchedBlocks,
      // Note: 'count' here reflects the number fetched, not total blocks in chain
      // The frontend uses a separate call for total block count
      count: fetchedBlocks.length,
      offset
    });
  } catch (error) {
    logger.error('Error fetching latest blocks via RPC:', error);
    next(error);
  }
});

// Get specific block by hash (DB first, then RPC fallback)
router.get('/hash/:hash', async (req, res, next) => {
  const { hash } = req.params;
  try {
    logger.info(`Fetching block by hash from DB: ${hash}`);
    const Block = await models.getBlock(); // Get Block model instance
    if (!Block) {
      throw new Error('Block model not initialized');
    }
    let block = await Block.findOne({ where: { hash: hash }, raw: true });

    if (block) {
      logger.info(`Found block ${hash} in DB`);
      res.json(block);
    } else {
      logger.warn(`Block ${hash} not found in DB, falling back to RPC`);
      try {
        block = await bitcoinzService.getBlock(hash, 1);
        if (!block) {
          return res.status(404).json({ error: 'Block not found via DB or RPC' });
        }
        logger.info(`Found block ${hash} via RPC`);
        res.json(block);
      } catch (rpcError) {
        logger.error(`Error fetching block ${hash} via RPC fallback:`, rpcError);
        if (rpcError.response?.data?.error?.code === -5 || rpcError.message.includes('Block not found')) {
           return res.status(404).json({ error: 'Block not found via DB or RPC' });
        }
        next(rpcError);
      }
    }
  } catch (error) {
    logger.error(`Error fetching block ${hash} (DB primary):`, error);
    next(error);
  }
});

// Get specific block by height (DB first, then RPC fallback)
router.get('/height/:height', async (req, res, next) => {
  const height = parseInt(req.params.height);
  try {
    logger.info(`Fetching block by height from DB: ${height}`);
    if (isNaN(height)) {
      return res.status(400).json({ error: 'Invalid block height' });
    }

    const Block = await models.getBlock(); // Get Block model instance
     if (!Block) {
      throw new Error('Block model not initialized');
    }
    let block = await Block.findOne({ where: { height: height }, raw: true });

    if (block) {
      logger.info(`Found block at height ${height} in DB`);
      res.json(block);
    } else {
      logger.warn(`Block at height ${height} not found in DB, falling back to RPC`);
      try {
        block = await bitcoinzService.getBlockByHeight(height, 1);
        if (!block) {
          return res.status(404).json({ error: 'Block not found via DB or RPC' });
        }
        logger.info(`Found block at height ${height} via RPC`);
        res.json(block);
      } catch (rpcError) {
        logger.error(`Error fetching block at height ${height} via RPC fallback:`, rpcError);
         if (rpcError.response?.data?.error?.code === -8 || rpcError.message.includes('Block height out of range')) {
           return res.status(404).json({ error: 'Block not found via DB or RPC' });
         }
        next(rpcError);
      }
    }
  } catch (error) {
    logger.error(`Error fetching block at height ${height} (DB primary):`, error);
    next(error);
  }
});

// Get latest block (DB first, then RPC fallback)
router.get('/latest', async (req, res, next) => {
  try {
    logger.info('Fetching latest block from DB');
    const Block = await models.getBlock(); // Get Block model instance
     if (!Block) {
      throw new Error('Block model not initialized');
    }
    let block = await Block.findOne({
      order: [['height', 'DESC']],
      raw: true
    });

    if (block) {
       logger.info(`Found latest block ${block.height} in DB`);
       res.json(block);
    } else {
       logger.warn('No blocks found in DB, falling back to RPC for latest block');
       try {
         const hash = await bitcoinzService.getBestBlockHash();
         block = await bitcoinzService.getBlock(hash, 1);
         if (!block) {
             return res.status(404).json({ error: 'Could not fetch latest block via RPC' });
         }
         logger.info(`Found latest block ${block.height} via RPC`);
         res.json(block);
       } catch (rpcError) {
          logger.error('Error fetching latest block via RPC fallback:', rpcError);
          next(rpcError);
       }
    }
  } catch (error) {
    logger.error('Error fetching latest block (DB primary):', error);
    next(error);
  }
});

module.exports = router;
