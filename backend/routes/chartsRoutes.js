const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');



// Very simple mined-block endpoint
router.get('/mined-block', (req, res) => {
  console.log('Mined-block endpoint hit!');
  
  try {
    // Simple static data with minimal processing
    const data = {
      date: '2025-04-18',
      days: 30,
      chartType: 'mined-block',
      data: []
    };
    
    // Generate some data points (only a few to keep it simple)
    for (let i = 0; i < 300; i++) {
      data.data.push({
        blockHeight: 1545720 - i,
        pool: ['Zpool', 'Zergpool', 'Others', 'DarkFiberMines', '2Mars'][Math.floor(Math.random() * 5)],
        size: Math.floor(Math.random() * 3000) + 500,
        timestamp: new Date().toISOString()
      });
    }
    
    // Return static data directly
    return res.json(data);
  } catch (error) {
    console.error('Error in mined-block endpoint:', error);
    return res.status(500).json({
      error: 'An unexpected error occurred',
      message: error.message
    });
  }
});

// Block size chart data
router.get('/block-size', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    
    // Generate test data
    const data = {
      date,
      days,
      chartType: 'block-size',
      data: []
    };
    
    // Create sample data points
    for (let i = 0; i < days; i++) {
      data.data.push({
        blockHeight: 1545720 - i * 10,
        blockSize: Math.floor(Math.random() * 3000) + 500,
        timestamp: new Date(Date.now() - (i * 86400000)).toISOString()
      });
    }
    
    return res.json(data);
  } catch (error) {
    console.error('Error in block-size endpoint:', error);
    return res.status(500).json({
      error: 'An unexpected error occurred',
      message: error.message
    });
  }
});

// Block interval chart data
router.get('/block-interval', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    
    // Generate test data
    const data = {
      date,
      days,
      chartType: 'block-interval',
      data: []
    };
    
    // Create sample data points
    for (let i = 0; i < days; i++) {
      data.data.push({
        blockHeight: 1545720 - i * 10,
        interval: Math.floor(Math.random() * 840) + 60,
        timestamp: new Date(Date.now() - (i * 86400000)).toISOString()
      });
    }
    
    return res.json(data);
  } catch (error) {
    console.error('Error in block-interval endpoint:', error);
    return res.status(500).json({
      error: 'An unexpected error occurred',
      message: error.message
    });
  }
});

// Difficulty chart data
router.get('/difficulty', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    
    // Generate test data
    const data = {
      date,
      days,
      chartType: 'difficulty',
      data: []
    };
    
    // Create sample data points
    for (let i = 0; i < days; i++) {
      const baseDifficulty = 700;
      const trend = i * 0.5;
      const random = Math.random() * 20 - 10;
      
      data.data.push({
        blockHeight: 1545720 - i * 10,
        difficulty: parseFloat((baseDifficulty - trend + random).toFixed(2)),
        timestamp: new Date(Date.now() - (i * 86400000)).toISOString()
      });
    }
    
    return res.json(data);
  } catch (error) {
    console.error('Error in difficulty endpoint:', error);
    return res.status(500).json({
      error: 'An unexpected error occurred',
      message: error.message
    });
  }
});

// Mining revenue chart data
router.get('/mining-revenue', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    
    // Generate test data
    const data = {
      date,
      days,
      chartType: 'mining-revenue',
      data: []
    };
    
    // Create sample data points
    for (let i = 0; i < days; i++) {
      data.data.push({
        blockHeight: 1545720 - i * 10,
        revenue: parseFloat((5 + Math.random() * 10).toFixed(4)),
        timestamp: new Date(Date.now() - (i * 86400000)).toISOString()
      });
    }
    
    return res.json(data);
  } catch (error) {
    console.error('Error in mining-revenue endpoint:', error);
    return res.status(500).json({
      error: 'An unexpected error occurred',
      message: error.message
    });
  }
});

// Pool stat chart data
router.get('/pool-stat', (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    
    // Static pool data
    const data = {
      date,
      chartType: 'pool-stat',
      data: [
        { name: 'Zpool', percentage: 31.8 },
        { name: 'Zergpool', percentage: 49.0 },
        { name: 'Others', percentage: 11.1 },
        { name: 'DarkFiberMines', percentage: 6.1 },
        { name: '2Mars', percentage: 2.0 }
      ]
    };
    
    return res.json(data);
  } catch (error) {
    console.error('Error in pool-stat endpoint:', error);
    return res.status(500).json({
      error: 'An unexpected error occurred',
      message: error.message
    });
  }
});

// Export the router
module.exports = router;