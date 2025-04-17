const express = require('express');
const router = express.Router();
const { 
  getRawTransaction, 
  getLatestTransactions,
  getBestBlockHash,
  getBlock
} = require('../services/bitcoinzService');
const { getTransaction: getTransactionModel } = require('../models');
const logger = require('../utils/logger');

// Get latest transactions
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    logger.info(`Fetching latest transactions with limit ${limit} and offset ${offset}`);
    
    // Get directly from node
    const transactions = await getLatestTransactions(limit + offset);
    
    // Apply offset
    const paginatedTransactions = transactions.slice(offset, offset + limit);
    
    logger.info(`Fetched ${paginatedTransactions.length} transactions`);
    
    res.json({
      transactions: paginatedTransactions,
      count: paginatedTransactions.length,
      offset
    });
  } catch (error) {
    logger.error('Error fetching transactions:', error);
    next(error);
  }
});

// Get specific transaction by txid
router.get('/:txid', async (req, res, next) => {
  try {
    const { txid } = req.params;
    logger.info(`Fetching transaction by txid: ${txid}`);
    
    // Get directly from node
    const transaction = await getRawTransaction(txid, 1);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json(transaction);
  } catch (error) {
    logger.error(`Error fetching transaction ${req.params.txid}:`, error);
    
    // Handle RPC specific errors
    if (error.response && error.response.data && error.response.data.error) {
      if (error.response.data.error.code === -5) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
    }
    
    next(error);
  }
});

// Get transactions by block hash
router.get('/block/:blockhash', async (req, res, next) => {
  try {
    const { blockhash } = req.params;
    logger.info(`Fetching transactions for block: ${blockhash}`);
    
    // Get block and its transactions
    const block = await getBlock(blockhash, 1);
    
    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }
    
    // Get transactions from txids
    const transactions = [];
    const txPromises = block.tx.slice(0, 20).map(txid => getRawTransaction(txid, 1));
    
    try {
      const results = await Promise.all(txPromises);
      transactions.push(...results);
    } catch (err) {
      logger.error(`Error fetching some transactions: ${err.message}`);
    }
    
    res.json({
      transactions,
      count: transactions.length,
      total: block.tx.length,
      blockhash
    });
  } catch (error) {
    logger.error(`Error fetching transactions for block ${req.params.blockhash}:`, error);
    next(error);
  }
});

module.exports = router;
