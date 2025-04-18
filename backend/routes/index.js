const express = require('express');
const router = express.Router();

// Import route modules
const blockRoutes = require('./blockRoutes');
const transactionRoutes = require('./transactionRoutes');
const addressRoutes = require('./addressRoutes');
const statsRoutes = require('./statsRoutes');
const searchRoutes = require('./searchRoutes');
const chartsRoutes = require('./chartsRoutes');
const testRoutes = require('./testRoutes');

// Console log to verify the routes are being loaded
console.log('Loading routes modules...');

// Use route modules
router.use('/blocks', blockRoutes);
router.use('/transactions', transactionRoutes);
router.use('/addresses', addressRoutes);
router.use('/stats', statsRoutes);
router.use('/search', searchRoutes);
router.use('/charts', chartsRoutes);
router.use('/test', testRoutes);

// Direct route for testing
router.get('/ping', (req, res) => {
  console.log('Ping endpoint hit directly on index router');
  res.json({ success: true, message: 'Pong!' });
});

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
      charts: '/api/charts'
    }
  });
});

module.exports = router;
