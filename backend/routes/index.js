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
const turboSyncRoutes = require('./turboSyncRoutes'); // Import turbo sync routes

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
router.use('/turbo-sync', turboSyncRoutes); // Register turbo sync routes

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
      turboSync: '/api/turbo-sync' // Add turbo sync endpoint info
    }
  });
});

module.exports = router;
