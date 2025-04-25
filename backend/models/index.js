const logger = require('../utils/logger');
const { getSequelize } = require('../db');

// Initialize models
let Block = null;
let Transaction = null;
let Address = null;
let Statistics = null;
let SyncStatus = null;

// Flag to track if models are initialized
let initialized = false;

// Initialize models with sequelize instance
const initializeModels = () => {
  try {
    if (initialized) {
      return { Block, Transaction, Address, Statistics, SyncStatus };
    }

    const sequelize = getSequelize();
    
    // If no sequelize connection, return null models
    if (!sequelize) {
      logger.warn('No database connection. Models not initialized.');
      return { Block: null, Transaction: null, Address: null, Statistics: null, SyncStatus: null };
    }
    
    logger.info('Initializing database models...');
    
    // Define models with sequelize instance
    Block = require('./postgres/Block')(sequelize);
    Transaction = require('./postgres/Transaction')(sequelize);
    Address = require('./postgres/Address')(sequelize);
    Statistics = require('./postgres/Statistics')(sequelize);
    SyncStatus = require('./postgres/SyncStatus')(sequelize);
    
    // Set up associations if needed
    // Block.hasMany(Transaction, { foreignKey: 'blockhash', sourceKey: 'hash' });
    // Transaction.belongsTo(Block, { foreignKey: 'blockhash', targetKey: 'hash' });
    
    initialized = true;
    logger.info('Database models initialized successfully');
    
    return { Block, Transaction, Address, Statistics, SyncStatus };
  } catch (error) {
    logger.error('Error initializing models:', error);
    return { Block: null, Transaction: null, Address: null, Statistics: null, SyncStatus: null };
  }
};

// Async accessors to ensure models are loaded with sequelize instance
const getBlock = async (sequelizeInstance = null) => {
  if (Block) return Block;
  
  const sequelize = sequelizeInstance || getSequelize();
  if (!sequelize) {
    logger.warn('No database connection available for Block model');
    return null;
  }
  
  return require('./postgres/Block')(sequelize);
};

const getTransaction = async (sequelizeInstance = null) => {
  if (Transaction) return Transaction;
  
  const sequelize = sequelizeInstance || getSequelize();
  if (!sequelize) {
    logger.warn('No database connection available for Transaction model');
    return null;
  }
  
  return require('./postgres/Transaction')(sequelize);
};

const getAddress = async (sequelizeInstance = null) => {
  if (Address) return Address;
  
  const sequelize = sequelizeInstance || getSequelize();
  if (!sequelize) {
    logger.warn('No database connection available for Address model');
    return null;
  }
  
  return require('./postgres/Address')(sequelize);
};

const getStatistics = async (sequelizeInstance = null) => {
  if (Statistics) return Statistics;
  
  const sequelize = sequelizeInstance || getSequelize();
  if (!sequelize) {
    logger.warn('No database connection available for Statistics model');
    return null;
  }
  
  return require('./postgres/Statistics')(sequelize);
};

const getSyncStatus = async (sequelizeInstance = null) => {
  if (SyncStatus) return SyncStatus;
  
  const sequelize = sequelizeInstance || getSequelize();
  if (!sequelize) {
    logger.warn('No database connection available for SyncStatus model');
    return null;
  }
  
  return require('./postgres/SyncStatus')(sequelize);
};

// Export models accessor functions
module.exports = {
  initializeModels,
  getBlock,
  getTransaction,
  getAddress,
  getStatistics,
  getSyncStatus,
  isInitialized: () => initialized
};
