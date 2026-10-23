const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'bitcoinz-explorer' },
  transports: [
    // new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Always log to the console (pm2 captures it). Without any transport winston
// buffers every entry in memory, which grows the process until pm2 restarts it.
const isProduction = process.env.NODE_ENV === 'production';
logger.add(new winston.transports.Console({
  level: process.env.LOG_LEVEL || logger.level,
  stderrLevels: ['error'],
  format: winston.format.combine(
    ...(isProduction ? [] : [winston.format.colorize()]),
    winston.format.timestamp({
      format: isProduction ? 'YYYY-MM-DD HH:mm:ss' : 'HH:mm:ss'
    }),
    winston.format.printf(
      ({ level, message, timestamp, stack }) => `${timestamp} ${level}: ${message}${stack ? `\n${stack}` : ''}`
    )
  )
}));

module.exports = logger;
