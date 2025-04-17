const express = require('express');
const router = express.Router();
const { 
  getBlockchainInfo, 
  getBestBlockHash, 
  getBlock, 
  getBlockByHeight 
} = require('../services/bitcoinzService');
const { getBlock: getBlockModel } = require('../models');
const logger = require('../utils/logger');

// Get latest blocks
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    
    // Get directly from node instead of database to avoid timeouts
    const info = await getBlockchainInfo();
    const bestHeight = info.blocks;
    
    logger.info(`Fetching blocks from height ${bestHeight} with offset ${offset} and limit ${limit}`);
    
    // Get blocks directly from node
    const blocks = [];
    for (let i = 0; i < limit && (bestHeight - i - offset) >= 0; i++) {
      const height = bestHeight - i - offset;
      try {
        const block = await getBlockByHeight(height, 1);
        blocks.push(block);
      } catch (err) {
        logger.error(`Error fetching block at height ${height}: ${err.message}`);
      }
    }
    
    logger.info(`Fetched ${blocks.length} blocks`);
    
    res.json({
      blocks,
      count: blocks.length,
      offset
    });
  } catch (error) {
    logger.error('Error fetching blocks:', error);
    next(error);
  }
});

// Get specific block by hash
router.get('/hash/:hash', async (req, res, next) => {
  try {
    const { hash } = req.params;
    logger.info(`Fetching block by hash: ${hash}`);
    
    // Get directly from node
    const block = await getBlock(hash, 1);
    
    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }
    
    res.json(block);
  } catch (error) {
    logger.error(`Error fetching block ${req.params.hash}:`, error);
    next(error);
  }
});

// Get specific block by height
router.get('/height/:height', async (req, res, next) => {
  try {
    const height = parseInt(req.params.height);
    logger.info(`Fetching block by height: ${height}`);
    
    if (isNaN(height)) {
      return res.status(400).json({ error: 'Invalid block height' });
    }
    
    // Get directly from node
    const block = await getBlockByHeight(height, 1);
    
    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }
    
    res.json(block);
  } catch (error) {
    logger.error(`Error fetching block at height ${req.params.height}:`, error);
    next(error);
  }
});

// Get latest block
router.get('/latest', async (req, res, next) => {
  try {
    logger.info('Fetching latest block');
    const hash = await getBestBlockHash();
    const block = await getBlock(hash, 1);
    
    res.json(block);
  } catch (error) {
    logger.error('Error fetching latest block:', error);
    next(error);
  }
});

module.exports = router;
