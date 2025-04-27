const express = require('express');
const router = express.Router();
const bitcoinzService = require('../services/bitcoinzService'); // Keep for fallbacks
const models = require('../models'); // Import the models module
const logger = require('../utils/logger');
const { Op } = require('sequelize'); // Import Op for queries

// Get latest transactions (Hybrid approach for faster loading)
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    logger.info(`Fetching latest transactions (limit: ${limit}, offset: ${offset})`);

    // Try DB first for cached results
    try {
      const Transaction = await models.getTransaction(); // Get Transaction model instance
      if (Transaction) {
        // Fetch latest transactions from the database with a short timeout
        const { count, rows: transactions } = await Promise.race([
          Transaction.findAndCountAll({
            order: [['blocktime', 'DESC']],
            limit: limit,
            offset: offset,
            raw: true
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('DB query timeout')), 500))
        ]);

        if (transactions && transactions.length > 0) {
          logger.info(`Fetched ${transactions.length} transactions from DB, total count: ${count}`);
          return res.json({
            transactions,
            count: count,
            offset,
            source: 'db'
          });
        }
      }
    } catch (dbError) {
      logger.warn(`DB transaction fetch failed or timed out: ${dbError.message}, falling back to RPC`);
    }

    // Fallback to direct RPC if DB fails or is empty
    // Fetch recent blocks first
    const bestBlockHash = await bitcoinzService.getBestBlockHash();
    let currentBlockHash = bestBlockHash;
    let fetchedTransactions = [];
    let blocksProcessed = 0;
    const MAX_BLOCKS = 10;

    // Process blocks in parallel batches
    const processBlocks = async (blockHashes) => {
      const blockPromises = blockHashes.map(hash => 
        bitcoinzService.getBlock(hash, 1)
          .catch(err => {
            logger.error(`Error fetching block ${hash}: ${err.message}`);
            return null;
          })
      );
      
      const blocks = (await Promise.all(blockPromises)).filter(b => b !== null);
      let nextHashes = [];
      
      for (const block of blocks) {
        // Get a subset of transactions from each block to avoid overwhelming the node
        const txsToProcess = block.tx.slice(0, Math.min(10, block.tx.length));
        const txPromises = txsToProcess.map(txid => 
          bitcoinzService.getRawTransaction(txid, 1)
            .catch(err => {
              logger.error(`Error fetching transaction ${txid}: ${err.message}`);
              return null;
            })
        );
        
        const blockTxs = (await Promise.all(txPromises)).filter(tx => tx !== null);
        fetchedTransactions = [...fetchedTransactions, ...blockTxs];
        
        if (block.previousblockhash) {
          nextHashes.push(block.previousblockhash);
        }
      }
      
      return nextHashes;
    };
    
    // Start with the best block
    let blockHashes = [currentBlockHash];
    
    // Process blocks until we have enough transactions or reach the limit
    while (fetchedTransactions.length < limit + offset && blocksProcessed < MAX_BLOCKS && blockHashes.length > 0) {
      blockHashes = await processBlocks(blockHashes);
      blocksProcessed += blockHashes.length;
    }
    
    // Sort transactions by time (newest first)
    fetchedTransactions.sort((a, b) => (b.time || 0) - (a.time || 0));
    
    // Apply pagination
    const paginatedTransactions = fetchedTransactions.slice(offset, offset + limit);
    
    logger.info(`Fetched ${paginatedTransactions.length} transactions via RPC from ${blocksProcessed} blocks`);
    
    res.json({
      transactions: paginatedTransactions,
      count: fetchedTransactions.length,
      offset,
      source: 'rpc'
    });
  } catch (error) {
    logger.error('Error fetching latest transactions:', error);
    next(error);
  }
});

// Get specific transaction by txid (DB first, then RPC fallback)
router.get('/:txid', async (req, res, next) => {
  const { txid } = req.params;
  try {
    logger.info(`Fetching transaction by txid from DB: ${txid}`);
    const Transaction = await models.getTransaction(); // Get Transaction model instance
     if (!Transaction) {
       throw new Error('Transaction model not initialized');
    }
    let transaction = await Transaction.findByPk(txid, { raw: true });

    if (transaction) {
      logger.info(`Found transaction ${txid} in DB`);
      try {
         if (typeof transaction.vin === 'string') transaction.vin = JSON.parse(transaction.vin);
         if (typeof transaction.vout === 'string') transaction.vout = JSON.parse(transaction.vout);
      } catch (e) { logger.warn(`Could not parse vin/vout for tx ${txid}`); }
      res.json(transaction);
    } else {
      logger.warn(`Transaction ${txid} not found in DB, falling back to RPC`);
      try {
        transaction = await bitcoinzService.getRawTransaction(txid, 1);
        if (!transaction) {
          return res.status(404).json({ error: 'Transaction not found via DB or RPC' });
        }
        logger.info(`Found transaction ${txid} via RPC`);
        res.json(transaction);
      } catch (rpcError) {
        logger.error(`Error fetching transaction ${txid} via RPC fallback:`, rpcError);
        if (rpcError.response?.data?.error?.code === -5 || rpcError.message.includes('No such mempool or blockchain transaction')) {
           return res.status(404).json({ error: 'Transaction not found via DB or RPC' });
        }
        next(rpcError);
      }
    }
  } catch (error) {
    logger.error(`Error fetching transaction ${txid} (DB primary):`, error);
    next(error);
  }
});

// Get transactions by block hash (DB only)
router.get('/block/:blockhash', async (req, res, next) => {
  const { blockhash } = req.params;
  try {
    logger.info(`Fetching transactions for block from DB: ${blockhash}`);
    const Transaction = await models.getTransaction(); // Get Transaction model instance
    const Block = await models.getBlock(); // Get Block model instance
     if (!Transaction || !Block) {
       throw new Error('Required models (Transaction or Block) not initialized');
    }

    // Fetch transactions directly from the Transaction table using the blockhash
    const transactions = await Transaction.findAll({
      where: { blockhash: blockhash },
      order: [['time', 'ASC']], // Order transactions within the block if desired
      raw: true
    });

    if (!transactions || transactions.length === 0) {
      const blockExists = await Block.count({ where: { hash: blockhash } });
      if (blockExists === 0) {
         logger.warn(`Block ${blockhash} not found in DB while fetching its transactions.`);
         return res.status(404).json({ error: 'Block not found in database' });
      }
      logger.info(`No transactions found in DB for block ${blockhash} (block exists)`);
       res.json({
         transactions: [],
         count: 0,
         total: 0,
         blockhash
       });
    } else {
       logger.info(`Found ${transactions.length} transactions in DB for block ${blockhash}`);
       transactions.forEach(tx => {
          try {
             if (typeof tx.vin === 'string') tx.vin = JSON.parse(tx.vin);
             if (typeof tx.vout === 'string') tx.vout = JSON.parse(tx.vout);
          } catch (e) { logger.warn(`Could not parse vin/vout for tx ${tx.txid}`); }
       });
       res.json({
         transactions,
         count: transactions.length,
         total: transactions.length,
         blockhash
       });
    }
  } catch (error) {
    logger.error(`Error fetching transactions for block ${blockhash} from DB:`, error);
    next(error);
  }
});

module.exports = router;
