/**
 * Production-Grade Logging System using Winston
 * 
 * Features:
 * - Category-specific loggers (orders, credit, webhooks, errors)
 * - Daily log rotation with date-based filenames
 * - Sensitive data sanitization
 * - Structured JSON logging
 * - Console output for development
 * - Separate error tracking
 * 
 * Log Files Location: /logs/
 * - app.log-YYYY-MM-DD (general app logs)
 * - orders.log-YYYY-MM-DD (order operations)
 * - credit.log-YYYY-MM-DD (credit transactions)
 * - webhooks.log-YYYY-MM-DD (webhook events)
 * - errors.log-YYYY-MM-DD (error tracking)
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

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
 * Custom format for Winston logs
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const sanitizedMeta = sanitize(meta);
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...sanitizedMeta,
      nodeEnv: process.env.NODE_ENV || 'development',
      pid: process.pid
    };
    return JSON.stringify(logEntry);
  })
);

/**
 * Get current date in YYYY-MM-DD format for daily rotation
 */
const getCurrentDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * Create a daily rotating filename
 * Returns filename with current date that will automatically include date in output
 */
const getDailyFilename = (baseFilename) => {
  return path.join(logsDir, `${baseFilename}-${getCurrentDate()}.log`);
};

/**
 * Create a logger instance with daily rotation
 */
const createCategoryLogger = (categoryName, filename) => {
  const transports = [];

  // File transport with daily rotation
  transports.push(
    new winston.transports.File({
      filename: getDailyFilename(filename),
      format: logFormat,
      level: 'info',
      maxsize: 10485760, // 10MB
      maxFiles: 14, // Keep 14 days of logs
    })
  );

  // Error file (captures errors from all levels)
  if (categoryName !== 'general') {
    transports.push(
      new winston.transports.File({
        filename: getDailyFilename(`errors-${categoryName}`),
        format: logFormat,
        level: 'error',
        maxsize: 10485760,
        maxFiles: 30, // Keep 30 days of error logs
      })
    );
  }

  // Console output in development
  if (process.env.NODE_ENV !== 'production') {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
            return `[${timestamp}] ${level}: ${message}${metaStr}`;
          })
        )
      })
    );
  }

  return winston.createLogger({
    defaultMeta: { category: categoryName },
    transports
  });
};

/**
 * Category-specific loggers
 */
const loggers = {
  app: createCategoryLogger('app', 'app'),
  orders: createCategoryLogger('orders', 'orders'),
  credit: createCategoryLogger('credit', 'credit'),
  webhooks: createCategoryLogger('webhooks', 'webhooks'),
  errors: createCategoryLogger('errors', 'errors')
};

/**
 * Unified logger object for backward compatibility
 */
const logger = {
  /**
   * General application logs
   */
  debug: (message, data = {}) => {
    loggers.app.debug(message, sanitize(data));
  },

  info: (message, data = {}) => {
    loggers.app.info(message, sanitize(data));
  },

  warn: (message, data = {}) => {
    loggers.app.warn(message, sanitize(data));
  },

  error: (message, data = {}) => {
    loggers.app.error(message, sanitize(data));
  },

  /**
   * Order-specific logging
   */
  orders: {
    info: (message, data = {}) => {
      loggers.orders.info(message, sanitize(data));
    },
    warn: (message, data = {}) => {
      loggers.orders.warn(message, sanitize(data));
    },
    error: (message, data = {}) => {
      loggers.orders.error(message, sanitize(data));
    },
    debug: (message, data = {}) => {
      loggers.orders.debug(message, sanitize(data));
    }
  },

  /**
   * Credit transaction logging
   */
  credit: {
    info: (message, data = {}) => {
      loggers.credit.info(message, sanitize(data));
    },
    warn: (message, data = {}) => {
      loggers.credit.warn(message, sanitize(data));
    },
    error: (message, data = {}) => {
      loggers.credit.error(message, sanitize(data));
    },
    debug: (message, data = {}) => {
      loggers.credit.debug(message, sanitize(data));
    }
  },

  /**
   * Webhook event logging
   */
  webhooks: {
    info: (message, data = {}) => {
      loggers.webhooks.info(message, sanitize(data));
    },
    warn: (message, data = {}) => {
      loggers.webhooks.warn(message, sanitize(data));
    },
    error: (message, data = {}) => {
      loggers.webhooks.error(message, sanitize(data));
    },
    debug: (message, data = {}) => {
      loggers.webhooks.debug(message, sanitize(data));
    }
  },

  /**
   * Error tracking logging
   */
  errors: {
    info: (message, data = {}) => {
      loggers.errors.info(message, sanitize(data));
    },
    warn: (message, data = {}) => {
      loggers.errors.warn(message, sanitize(data));
    },
    error: (message, data = {}) => {
      loggers.errors.error(message, sanitize(data));
    },
    debug: (message, data = {}) => {
      loggers.errors.debug(message, sanitize(data));
    }
  }
};

/**
 * Request logging middleware
 * Logs incoming requests with method, path, status, and response time
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
      ...(req.method !== 'GET' && req.body && Object.keys(req.body).length > 0 && {
        bodyKeys: Object.keys(req.body)
      })
    };

    Object.keys(logData).forEach(key => logData[key] === undefined && delete logData[key]);

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

/**
 * Log rotation maintenance function
 * Call this periodically (e.g., daily) to clean up old logs
 * Keeps: app logs (14 days), error logs (30 days), category logs (14 days)
 */
const cleanupOldLogs = () => {
  const now = Date.now();
  const FILE_RETENTION = {
    'errors': 30 * 24 * 60 * 60 * 1000, // 30 days for errors
    'default': 14 * 24 * 60 * 60 * 1000  // 14 days for other logs
  };

  try {
    fs.readdirSync(logsDir).forEach(file => {
      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);
      const isErrorLog = file.includes('errors');
      const retention = isErrorLog ? FILE_RETENTION.errors : FILE_RETENTION.default;

      if (now - stats.mtimeMs > retention) {
        fs.unlinkSync(filePath);
        logger.info(`Cleaned up old log file: ${file}`);
      }
    });
  } catch (error) {
    logger.error('Error during log cleanup', { error: error.message });
  }
};

module.exports = {
  logger,
  requestLogger,
  sanitize,
  cleanupOldLogs,
  loggers,
  logsDir
};
