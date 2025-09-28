const winston = require('winston');
const morgan = require('morgan');
const path = require('path');

// BONUS: Professional logging system with Winston
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'user-management-api' },
  transports: [
    // Write all logs with importance level of `error` or higher to `error.log`
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs to `combined.log`
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ]
});

// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Morgan HTTP request logger setup
const morganFormat = ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms';

// Create a write stream for access logs
const accessLogStream = require('fs').createWriteStream(
  path.join(__dirname, '../logs/access.log'),
  { flags: 'a' }
);

// Morgan middleware for HTTP request logging
const httpLogger = morgan(morganFormat, {
  stream: accessLogStream,
  skip: function (req, res) {
    // Skip logging for health checks and static files
    return req.url === '/health' || req.url.startsWith('/public');
  }
});

// Security event logger
const logSecurityEvent = (event, req, additionalInfo = {}) => {
  logger.warn('SECURITY_EVENT', {
    event,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    url: req.url,
    method: req.method,
    userId: req.user?.id,
    timestamp: new Date().toISOString(),
    ...additionalInfo
  });
};

// Authentication event logger
const logAuthEvent = (event, req, userId = null, additionalInfo = {}) => {
  logger.info('AUTH_EVENT', {
    event,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId,
    timestamp: new Date().toISOString(),
    ...additionalInfo
  });
};

// API usage logger
const logApiUsage = (req, res, responseTime) => {
  logger.info('API_USAGE', {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    responseTime,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  logger,
  httpLogger,
  logSecurityEvent,
  logAuthEvent,
  logApiUsage
};