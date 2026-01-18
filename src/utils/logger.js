/**
 * Production-Grade Structured Logger
 * 
 * Uses Winston for structured logging
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const observabilityConfig = require('../config/observability.config');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for structured logging
const structuredFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
    winston.format.printf((info) => {
        const { timestamp, level, message, ...meta } = info;
        
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            message,
            ...meta,
            service: 'whatsapp-ordering-backend',
            environment: process.env.NODE_ENV || 'development',
            pid: process.pid
        };
        
        return JSON.stringify(logEntry);
    })
);

// Pretty format for development
const prettyFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
    })
);

// Create transports array
const transports = [];

// Console transport
if (observabilityConfig.LOGGING.DESTINATIONS.CONSOLE) {
    transports.push(
        new winston.transports.Console({
            format: observabilityConfig.LOGGING.FORMAT === 'json' 
                ? structuredFormat 
                : prettyFormat,
            level: observabilityConfig.LOGGING.LEVEL
        })
    );
}

// File transports
if (observabilityConfig.LOGGING.DESTINATIONS.FILE) {
    // App log (all logs)
    transports.push(
        new winston.transports.File({
            filename: path.join(logsDir, 'app.log'),
            format: structuredFormat,
            level: 'info',
            maxsize: 20 * 1024 * 1024, // 20MB
            maxFiles: 14
        })
    );
    
    // Error log (errors only)
    transports.push(
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            format: structuredFormat,
            level: 'error',
            maxsize: 20 * 1024 * 1024,
            maxFiles: 14
        })
    );
}

// Create logger instance
const logger = winston.createLogger({
    level: observabilityConfig.LOGGING.LEVEL,
    format: structuredFormat,
    transports,
    exitOnError: false
});

/**
 * Create child logger with context
 */
logger.child = function(context = {}) {
    return winston.createLogger({
        level: this.level,
        format: this.format,
        transports: this.transports,
        defaultMeta: context
    });
};

/**
 * Log business event
 */
logger.businessEvent = function(event, data = {}, correlationId = null) {
    this.info('Business event', {
        event,
        eventType: 'business',
        correlationId,
        ...data
    });
};

/**
 * Log performance metric
 */
logger.metric = function(metric, value, tags = {}, correlationId = null) {
    this.info('Performance metric', {
        metric,
        value,
        metricType: 'performance',
        correlationId,
        ...tags
    });
};

/**
 * Log error with full context
 */
logger.errorWithContext = function(error, context = {}, correlationId = null) {
    this.error('Error occurred', {
        error: {
            name: error.name,
            message: error.message,
            stack: error.stack
        },
        correlationId,
        ...context
    });
};

module.exports = logger;
