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
  DB_PASSWORD
} = process.env;

// Use system username as fallback
if (!DB_USER) {
  DB_USER = os.userInfo().username;
  logger.info(`No DB_USER specified, using system username: ${DB_USER}`);
}

let sequelize;

// Initialize database connection
const initializeDatabase = async () => {
  // Assuming PostgreSQL is the only database type
  if (DB_TYPE !== 'postgres') {
    logger.warn(`DB_TYPE is set to '${DB_TYPE}' or not set. Assuming PostgreSQL, but please set DB_TYPE=postgres in your environment.`);
  }

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
    
    throw error; // Re-throw the original or retry error if fallback fails
  }
};

module.exports = {
  initializeDatabase,
  getSequelize: () => sequelize,
  // Removed getMongoose export
};
