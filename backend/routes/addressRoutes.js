const express = require('express');
const router = express.Router();
const { getAddressBalanceHistory } = require('../services/bitcoinzService');
const addressService = require('../services/addressService');
const { getAddress: getAddressModel } = require('../models');
const logger = require('../utils/logger');

// Get address info
router.get('/:address', async (req, res, next) => {
  try {
    const { address } = req.params;
    logger.info(`Fetching address info: ${address}`);
    
    // Add a longer timeout for requests to handle large addresses
    req.setTimeout(90000); // 90 seconds timeout
    
    try {
      // Get address data from our enhanced service
      const addressInfo = await addressService.getAddressInfo(address);
      
      // Return address info
      res.json(addressInfo);
    } catch (serviceError) {
      logger.error(`Address service error for ${address}:`, serviceError);
      
      // Return a more user-friendly error
      res.status(500).json({
        error: 'Address lookup failed',
        message: 'Could not retrieve address data at this time. Please try again later.'
      });
    }
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
    
    logger.info(`Fetching transactions for address ${address} (limit: ${limit}, offset: ${offset})`);
    
    // Add a longer timeout for requests to handle large addresses
    req.setTimeout(90000); // 90 seconds timeout
    
    try {
      // Get transaction data from our enhanced service
      const transactions = await addressService.getAddressTransactions(address, limit, offset);
      
      // Return transactions
      res.json(transactions);
    } catch (serviceError) {
      logger.error(`Transaction fetch error for ${address}:`, serviceError);
      
      // Return a more user-friendly error
      res.status(500).json({
        error: 'Transaction lookup failed',
        message: 'Could not retrieve transaction data at this time. Please try again later.'
      });
    }
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
    
    // Get address data using the service (DB first, then RPC fallback)
    const addressInfo = await addressService.getAddressInfo(address);
    
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
