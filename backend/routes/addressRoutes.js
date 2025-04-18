const express = require('express');
const router = express.Router();
const { getAddressInfo, getAddressTransactions, getAddressBalanceHistory } = require('../services/bitcoinzService');
const { getAddress: getAddressModel } = require('../models');
const logger = require('../utils/logger');

// Get address info
router.get('/:address', async (req, res, next) => {
  try {
    const { address } = req.params;
    logger.info(`Fetching address info: ${address}`);
    
    // Get real address data from the blockchain
    const addressInfo = await getAddressInfo(address);
    
    res.json(addressInfo);
  } catch (error) {
    logger.error(`Error fetching address ${req.params.address}:`, error);
    next(error);
  }
});

// Get address transactions
router.get('/:address/transactions', async (req, res, next) => {
  try {
    const { address } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    
    logger.info(`Fetching transactions for address ${address}`);
    
    // Get real transaction data from the blockchain
    const transactions = await getAddressTransactions(address, limit, offset);
    
    res.json(transactions);
  } catch (error) {
    logger.error(`Error fetching transactions for address ${req.params.address}:`, error);
    next(error);
  }
});

// Get address balance
router.get('/:address/balance', async (req, res, next) => {
  try {
    const { address } = req.params;
    logger.info(`Fetching balance for address ${address}`);
    
    // Get real address data from the blockchain
    const addressInfo = await getAddressInfo(address);
    
    // Return just the balance information
    res.json({
      address,
      balance: addressInfo.balance,
      totalReceived: addressInfo.totalReceived,
      totalSent: addressInfo.totalSent,
      unconfirmedBalance: addressInfo.unconfirmedBalance
    });
  } catch (error) {
    logger.error(`Error fetching balance for address ${req.params.address}:`, error);
    next(error);
  }
});

// Get address balance history
router.get('/:address/history', async (req, res, next) => {
  try {
    const { address } = req.params;
    const days = parseInt(req.query.days) || 30;
    
    logger.info(`Fetching balance history for address ${address}`);
    
    // Get real balance history data
    const history = await getAddressBalanceHistory(address, days);
    
    res.json(history);
  } catch (error) {
    logger.error(`Error fetching balance history for address ${req.params.address}:`, error);
    next(error);
  }
});

module.exports = router;
