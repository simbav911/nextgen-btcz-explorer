const express = require('express');
const router = express.Router();

// Import route modules
const blockRoutes = require('./blockRoutes');
const transactionRoutes = require('./transactionRoutes');
const addressRoutes = require('./addressRoutes');
const statsRoutes = require('./statsRoutes');
const searchRoutes = require('./searchRoutes');

// Use route modules
router.use('/blocks', blockRoutes);
router.use('/transactions', transactionRoutes);
router.use('/addresses', addressRoutes);
router.use('/stats', statsRoutes);
router.use('/search', searchRoutes);

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
      search: '/api/search'
    }
  });
});

module.exports = router;
