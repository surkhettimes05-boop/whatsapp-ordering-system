/**
 * MIGRATION BRIDGE: Convert old logger.js to use new Winston logger
 * 
 * This preserves backward compatibility while using the new Winston-based system
 * Copy this content into src/config/logger.js after backing up the original
 */

const { logger: winstonLogger, requestLogger: winstonRequestLogger } = require('./winston-logger');

/**
 * Backward-compatible logger wrapper
 * Maps old logger interface to new Winston logger
 */
const logger = {
  /**
   * Debug level - detailed information for debugging
   */
  debug: (message, data = {}) => {
    winstonLogger.debug(message, data);
  },

  /**
   * Info level - general informational messages
   */
  info: (message, data = {}) => {
    winstonLogger.info(message, data);
  },

  /**
   * Warn level - warning messages
   */
  warn: (message, data = {}) => {
    winstonLogger.warn(message, data);
  },

  /**
   * Error level - error messages
   */
  error: (message, data = {}) => {
    winstonLogger.error(message, data);
  }
};

/**
 * Log levels enum
 */
const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

/**
 * Sensitive fields that should never be logged
 * (Already handled in winston-logger.js, included here for reference)
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
 * Sanitize function (wrapper around Winston's built-in sanitization)
 */
const sanitize = (obj, depth = 0) => {
  if (depth > 10) return '[OBJECT_TOO_DEEP]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitize(item, depth + 1));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
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
 * Request logging middleware - wraps Winston middleware
 * Maintains backward compatibility with existing code
 */
const requestLogger = winstonRequestLogger;

/**
 * Export all interfaces (backward compatible)
 */
module.exports = {
  logger,
  requestLogger,
  sanitize,
  LogLevel
};
