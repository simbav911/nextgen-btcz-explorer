const express = require('express');
const router = express.Router();
const { Op } = require('sequelize'); // Import Op for OR queries
const {
  getBlock: getRpcBlock, // Rename to avoid conflict with model accessor
  getBlockByHeight: getRpcBlockByHeight, // Rename
  getRawTransaction
} = require('../services/bitcoinzService');
const {
  getBlock,
  getTransaction,
  getAddress
} = require('../models'); // Import model accessors
const logger = require('../utils/logger');

// Search endpoint - handles blocks, transactions, addresses
router.get('/', async (req, res, next) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    // Initialize result object
    const result = {
      query,
      type: null,
      result: null
    };
    
    // Check if query is a block height (numbers only)
    if (/^\d+$/.test(query)) {
      try {
        const height = parseInt(query);
        const block = await getRpcBlockByHeight(height); // Use renamed RPC function
        
        if (block) {
          result.type = 'block';
          result.result = block;
          return res.json(result);
        }
      } catch (error) {
        // Not a valid block height, continue searching
        logger.debug(`${query} is not a valid block height`);
      }
    }
    
    // Check if query is a block hash (64 chars hex)
    if (/^[0-9a-fA-F]{64}$/.test(query)) {
      try {
        // Try as block hash
        const block = await getRpcBlock(query); // Use renamed RPC function
        
        if (block) {
          result.type = 'block';
          result.result = block;
          return res.json(result);
        }
      } catch (blockError) {
        // Not a block hash, try as transaction
        try {
          const tx = await getRawTransaction(query, 1);
          
          if (tx) {
            result.type = 'transaction';
            result.result = tx;
            return res.json(result);
          }
        } catch (txError) {
          // Not a transaction either
          logger.debug(`${query} is neither a block hash nor a transaction ID`);
        }
      }
    }
    
    // Check if query is an address
    // For a real BitcoinZ implementation, you'd need to validate the address format
    // This is a simplified check
    if (query.length >= 26 && query.length <= 35 && query.startsWith('t1')) {
      try {
        logger.debug(`Checking if ${query} is a valid BitcoinZ address`);
        
        // Always return a valid result for BitcoinZ addresses starting with t1
        // This ensures the frontend can navigate to the address page
        result.type = 'address';
        result.result = {
          address: query,
          balance: 0,
          transactions: [],
          transactionCount: 0
        };
        return res.json(result);
      } catch (error) {
        logger.debug(`Error searching for address ${query}:`, error);
      }
    }
    
    // If we get here, no results were found
    return res.status(404).json({
      query,
      type: null,
      error: 'No matching blocks, transactions, or addresses found'
    });
  } catch (error) {
    logger.error(`Error processing search for ${req.query.query}:`, error);
    next(error);
  }
});

module.exports = router;
