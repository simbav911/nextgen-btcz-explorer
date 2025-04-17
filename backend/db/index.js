const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');
const os = require('os');

// Load environment variables
let {
  DB_TYPE,
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  MONGODB_URI
} = process.env;

// Use system username as fallback
if (!DB_USER) {
  DB_USER = os.userInfo().username;
  logger.info(`No DB_USER specified, using system username: ${DB_USER}`);
}

let sequelize;
let mongoose;

// Initialize database connection
const initializeDatabase = async () => {
  // Check if using PostgreSQL
  if (DB_TYPE === 'postgres') {
    logger.info('Initializing PostgreSQL connection');
    
    try {
      sequelize = new Sequelize({
        dialect: 'postgres',
        host: DB_HOST,
        port: DB_PORT,
        database: DB_NAME,
        username: DB_USER,
        password: DB_PASSWORD || undefined, // Use undefined if empty string
        logging: false, // Set to true for SQL debugging
        define: {
          timestamps: true,
          underscored: true
        },
        // Add additional connection options for better resilience
        pool: {
          max: 10,
          min: 0,
          acquire: 30000,
          idle: 10000
        },
        retry: {
          max: 3
        }
      });

      await sequelize.authenticate();
      logger.info('PostgreSQL connection has been established successfully.');
      
      // We'll handle schema creation separately in setup-db.js
      
      return { sequelize, type: 'postgres' };
    } catch (error) {
      logger.error('Unable to connect to PostgreSQL database:', error);
      
      // Try with system username as fallback
      if (error.original && error.original.code === '28000' && error.original.routine === 'InitializeSessionUserId') {
        const systemUser = os.userInfo().username;
        if (DB_USER !== systemUser) {
          logger.info(`Attempting to connect with system username: ${systemUser}`);
          DB_USER = systemUser;
          
          try {
            sequelize = new Sequelize({
              dialect: 'postgres',
              host: DB_HOST,
              port: DB_PORT,
              database: DB_NAME,
              username: DB_USER,
              password: DB_PASSWORD || undefined,
              logging: false,
              define: {
                timestamps: true,
                underscored: true
              }
            });
            
            await sequelize.authenticate();
            logger.info(`Successfully connected with user: ${DB_USER}`);
            return { sequelize, type: 'postgres' };
          } catch (retryError) {
            logger.error('Failed to connect with system username:', retryError);
            throw retryError;
          }
        }
      }
      
      throw error;
    }
  } 
  // Fallback to MongoDB if configured
  else if (MONGODB_URI) {
    logger.info('Initializing MongoDB connection');
    mongoose = require('mongoose');
    
    try {
      await mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      logger.info('MongoDB connection has been established successfully.');
      return { mongoose, type: 'mongodb' };
    } catch (error) {
      logger.error('Unable to connect to MongoDB database:', error);
      throw error;
    }
  } 
  // Direct RPC mode without database
  else {
    logger.warn('No database configuration found. Running in direct RPC mode only.');
    return { type: 'rpc' };
  }
};

module.exports = {
  initializeDatabase,
  getSequelize: () => sequelize,
  getMongoose: () => mongoose
};
