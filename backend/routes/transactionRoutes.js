const express = require('express');
const router = express.Router();
const bitcoinzService = require('../services/bitcoinzService'); // Keep for fallbacks
const models = require('../models'); // Import the models module
const logger = require('../utils/logger');
const { Op } = require('sequelize'); // Import Op for queries

// Get latest transactions (Prioritize Database)
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    logger.info(`Fetching latest transactions from DB (limit: ${limit}, offset: ${offset})`);

    const Transaction = await models.getTransaction(); // Get Transaction model instance
    if (!Transaction) {
       throw new Error('Transaction model not initialized');
    }

    // Fetch latest transactions from the database, ordered by block time
    const { count, rows: transactions } = await Transaction.findAndCountAll({
      order: [['blocktime', 'DESC']], // Order by blocktime (assuming it's reliably populated)
      limit: limit,
      offset: offset,
      raw: true // Get plain objects
    });

    logger.info(`Fetched ${transactions.length} transactions from DB, total count: ${count}`);

    res.json({
      transactions,
      count: count, // Total count in the database
      offset
    });
  } catch (error) {
    logger.error('Error fetching latest transactions from DB:', error);
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
