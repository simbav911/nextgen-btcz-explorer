require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const logger = require('./utils/logger');
const routes = require('./routes');
const { setupSocket } = require('./services/socketService');
const { initializeNodeConnection } = require('./services/bitcoinzService');
const { initializePoolService } = require('./services/poolService');
const { initializeDatabase } = require('./db');
const { initializeModels } = require('./models');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  allowUpgrades: true,
  cookie: false
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup Socket.io
setupSocket(io);

// API Routes
app.use('/api', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Something went wrong on the server'
    }
  });
});

// Import the indexer service
const { initializeIndexer } = require('./services/indexerService');

// Connect to database and start server
const startServer = async () => {
  try {
    // Initialize BitcoinZ Node Connection first
    logger.info('Connecting to BitcoinZ node...');
    await initializeNodeConnection();
    logger.info('Connected to BitcoinZ node');
    
    // Initialize Pool Service
    logger.info('Initializing pool service...');
    initializePoolService();
    logger.info('Pool service initialized');
    
    // Try to initialize database connection
    logger.info('Initializing database...');
    let dbType = 'none';
    
    try {
      const db = await initializeDatabase();
      if (db) {
        dbType = db.type;
        logger.info(`Connected to database (${dbType})`);
      }
    } catch (dbError) {
      logger.warn('Database initialization failed, running in direct RPC mode:', dbError.message);
      dbType = 'none';
    }
    
    // Initialize models if database is available
    if (dbType === 'postgres') {
      try {
        initializeModels();
        
        // Start the blockchain indexer service
        logger.info('Starting blockchain indexer service...');
        await initializeIndexer();
        logger.info('Blockchain indexer service started');
      } catch (modelError) {
        logger.warn('Model initialization failed:', modelError.message);
      }
    }
    
    // Start server
    const PORT = process.env.PORT || 3001;
    const HOST = process.env.HOST || '0.0.0.0';
    server.listen(PORT, HOST, () => {
      logger.info(`Server running on ${HOST}:${PORT}`);
      logger.info(`BitcoinZ Explorer API available at http://${HOST}:${PORT}/api`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down server...');
  
  // Close server
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  
  // Force close after timeout
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle termination signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
