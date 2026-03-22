const express = require('express');
const router = express.Router();
const bitcoinzService = require('../services/bitcoinzService');
const models = require('../models');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const { Op } = require('sequelize');

// Get latest blocks — DB-first with RPC fallback (eliminates 101 RPC calls per page)
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    // Check server-side response cache first (10s TTL)
    const cacheKey = `blocklist:${limit}:${offset}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    // Try DB first
    let Block;
    try {
      Block = await models.getBlock();
    } catch (e) {
      Block = null;
    }

    if (Block) {
      const dbBlocks = await Block.findAll({
        order: [['height', 'DESC']],
        limit,
        offset,
        raw: true
      });

      if (dbBlocks && dbBlocks.length > 0) {
        // For the first page (offset === 0), verify DB data is fresh
        const STALE_BLOCK_THRESHOLD = 10;
        let dbIsStale = false;
        if (offset === 0) {
          try {
            const info = await bitcoinzService.getBlockchainInfo();
            const chainTip = info.blocks;
            const dbTip = dbBlocks[0].height;
            if (chainTip - dbTip > STALE_BLOCK_THRESHOLD) {
              logger.warn(`DB blocks are stale: DB tip ${dbTip}, chain tip ${chainTip} (gap: ${chainTip - dbTip}). Falling back to RPC.`);
              dbIsStale = true;
            }
          } catch (infoError) {
            logger.warn(`Could not check block freshness: ${infoError.message}. Serving DB data.`);
          }
        }

        if (!dbIsStale) {
          logger.info(`Served ${dbBlocks.length} blocks from DB (offset ${offset})`);
          const result = { blocks: dbBlocks, count: dbBlocks.length, offset };
          cache.set(cacheKey, result, 10000);
          return res.json(result);
        }
      }
    }

    // Fallback to RPC if DB is empty
    const info = await bitcoinzService.getBlockchainInfo();
    const bestHeight = info.blocks;

    logger.info(`DB empty, fetching blocks from RPC (height ${bestHeight}, offset ${offset}, limit ${limit})`);

    const heightsToFetch = [];
    for (let i = 0; i < limit && (bestHeight - i - offset) >= 0; i++) {
      heightsToFetch.push(bestHeight - i - offset);
    }

    const batchSize = 4;
    const fetchedBlocks = [];

    for (let i = 0; i < heightsToFetch.length; i += batchSize) {
      const batch = heightsToFetch.slice(i, i + batchSize);
      const batchPromises = batch.map(async height => {
        try {
          const block = await bitcoinzService.getBlockByHeight(height, 1);
          if (block && block.tx && block.tx.length > 0) {
            const coinbaseTxid = block.tx[0];
            try {
              const coinbaseTx = await bitcoinzService.getRawTransaction(coinbaseTxid, 1);
              if (coinbaseTx && coinbaseTx.vin && coinbaseTx.vin.length > 0 && coinbaseTx.vin[0].coinbase) {
                block.coinbaseHex = coinbaseTx.vin[0].coinbase;
              } else {
                block.coinbaseHex = null;
              }
            } catch (txError) {
              logger.error(`Error fetching coinbase tx for block ${height}: ${txError.message}`);
              block.coinbaseHex = null;
            }
          } else {
            if (block) block.coinbaseHex = null;
          }
          return block;
        } catch (err) {
          logger.error(`Error fetching block at height ${height} via RPC: ${err.message}`);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      fetchedBlocks.push(...batchResults.filter(block => block !== null));
    }

    const result = { blocks: fetchedBlocks, count: fetchedBlocks.length, offset };
    cache.set(cacheKey, result, 10000);
    res.json(result);
  } catch (error) {
    logger.error('Error fetching latest blocks:', error);
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
