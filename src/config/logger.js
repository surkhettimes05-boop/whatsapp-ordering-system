/**
 * Centralized Logger Configuration
 * 
 * Features:
 * - Request/Response logging
 * - Error logging with context
 * - No sensitive data logging (passwords, tokens, etc.)
 * - Structured logging for production
 * - Different log levels (debug, info, warn, error)
 * - Timestamps on all logs
 */

const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Log levels
 */
const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

/**
 * Sensitive fields that should never be logged
 */
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'jwt',
  'secret',
  'apiKey',
  'apiSecret',
  'authToken',
  'bearerToken',
  'creditCardNumber',
  'ssn',
  'dateOfBirth',
  'email',
  'phone',
  'accountNumber'
];

/**
 * Recursively sanitize an object to remove sensitive data
 */
const sanitize = (obj, depth = 0) => {
  // Prevent infinite recursion
  if (depth > 10) return '[OBJECT_TOO_DEEP]';
  
  if (obj === null || obj === undefined) return obj;
  
  // Handle primitives
  if (typeof obj !== 'object') return obj;
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitize(item, depth + 1));
  }
  
  // Handle objects
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Check if key is sensitive
    const isSensitive = SENSITIVE_FIELDS.some(field =>
      key.toLowerCase().includes(field.toLowerCase())
    );
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitize(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

/**
 * Format log message
 */
const formatLog = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  const sanitizedData = sanitize(data);
  
  const logEntry = {
    timestamp,
    level,
    message,
    ...sanitizedData,
    nodeEnv: process.env.NODE_ENV || 'development',
    pid: process.pid
  };
  
  return JSON.stringify(logEntry);
};

/**
 * Write to log file
 */
const writeToFile = (filename, content) => {
  const filepath = path.join(logsDir, filename);
  fs.appendFileSync(filepath, content + '\n');
};

/**
 * Logger instance
 */
const logger = {
  /**
   * Debug level - detailed information for debugging
   */
  debug: (message, data = {}) => {
    const logLine = formatLog(LogLevel.DEBUG, message, data);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔧 ${message}`, data);
    }
    writeToFile('debug.log', logLine);
  },

  /**
   * Info level - general informational messages
   */
  info: (message, data = {}) => {
    const logLine = formatLog(LogLevel.INFO, message, data);
    console.log(`ℹ️  ${message}`);
    writeToFile('app.log', logLine);
  },

  /**
   * Warn level - warning messages
   */
  warn: (message, data = {}) => {
    const logLine = formatLog(LogLevel.WARN, message, data);
    console.warn(`⚠️  ${message}`, data);
    writeToFile('app.log', logLine);
  },

  /**
   * Error level - error messages
   */
  error: (message, data = {}) => {
    const logLine = formatLog(LogLevel.ERROR, message, data);
    console.error(`❌ ${message}`, data);
    writeToFile('error.log', logLine);
  }
};

/**
 * Request logging middleware
 * Logs incoming requests with method, path, status, and response time
 */
const requestLogger = (req, res, next) => {
  // Start timer
  const startTime = Date.now();
  
  // Generate unique request ID
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Capture the original res.json and res.send
  const originalJson = res.json;
  const originalSend = res.send;
  
  res.json = function(data) {
    logResponse(data);
    return originalJson.call(this, data);
  };
  
  res.send = function(data) {
    if (typeof data === 'object') {
      logResponse(data);
    }
    return originalSend.call(this, data);
  };
  
  const logResponse = (data) => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    const logData = {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id || 'anonymous',
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      // Only log body for certain methods, never log sensitive data
      ...(req.method !== 'GET' && req.body && Object.keys(req.body).length > 0 && {
        bodyKeys: Object.keys(req.body) // Log only the keys, not values
      })
    };
    
    // Remove undefined values
    Object.keys(logData).forEach(key => logData[key] === undefined && delete logData[key]);
    
    // Log based on status code
    if (statusCode >= 500) {
      logger.error(`Request failed: ${req.method} ${req.path}`, logData);
    } else if (statusCode >= 400) {
      logger.warn(`Request rejected: ${req.method} ${req.path}`, logData);
    } else {
      logger.info(`Request completed: ${req.method} ${req.path}`, logData);
    }
  };
  
  next();
};

module.exports = {
  logger,
  requestLogger,
  sanitize,
  LogLevel
};
