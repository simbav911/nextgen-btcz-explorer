const express = require('express');
const router = express.Router();

// Import route modules
const blockRoutes = require('./blockRoutes');
const transactionRoutes = require('./transactionRoutes');
const addressRoutes = require('./addressRoutes');
const statsRoutes = require('./statsRoutes');
const searchRoutes = require('./searchRoutes');
const chartsRoutes = require('./chartsRoutes');
const wealthRoutes = require('./wealthRoutes');
const poolStatsRoutes = require('./poolStatsRoutes');
const syncRoutes = require('./syncRoutes'); // Import sync routes
const cmcRoutes = require('./cmcRoutes');
const miningRoutes = require('./miningRoutes');

// Use route modules
router.use('/blocks', blockRoutes);
router.use('/transactions', transactionRoutes);
router.use('/addresses', addressRoutes);
router.use('/stats', statsRoutes);
router.use('/search', searchRoutes);
router.use('/charts', chartsRoutes);
router.use('/wealth', wealthRoutes);
router.use('/pool-stats', poolStatsRoutes);
router.use('/sync', syncRoutes); // Register sync routes
router.use('/cmc', cmcRoutes);
router.use('/mining', miningRoutes);

// Root endpoint - API info
router.get('/', (req, res) => {
  res.json({
    name: 'BitcoinZ Explorer API',
    version: '1.0.0',
    endpoints: {
      blocks: '/api/blocks',
      transactions: '/api/transactions',
      addresses: '/api/addresses',
      stats: '/api/stats',
      search: '/api/search',
      charts: '/api/charts',
      wealth: '/api/wealth',
      poolStats: '/api/pool-stats',
      sync: '/api/sync', // Add sync endpoint info
      cmc: '/api/cmc',
      mining: '/api/mining'
    }
  });
});

module.exports = router;
