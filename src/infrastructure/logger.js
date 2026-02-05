const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
require('dotenv').config();

// Custom log format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, messageId, userId, action, duration, error, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      service: service || 'whatsapp-messaging',
      message,
      ...(messageId && { messageId }),
      ...(userId && { userId }),
      ...(action && { action }),
      ...(duration && { duration }),
      ...(error && { error: error.message || error }),
      ...meta
    };
    return JSON.stringify(logEntry);
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'whatsapp-messaging' },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),

    // File transport for all logs
    new DailyRotateFile({
      filename: 'logs/messaging-%DATE%.log',
      datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
      maxSize: process.env.LOG_MAX_SIZE || '100m',
      maxFiles: process.env.LOG_MAX_FILES || '30d',
      zippedArchive: true
    }),

    // Error-only file transport
    new DailyRotateFile({
      filename: 'logs/messaging-errors-%DATE%.log',
      datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
      level: 'error',
      maxSize: process.env.LOG_MAX_SIZE || '100m',
      maxFiles: process.env.LOG_MAX_FILES || '30d',
      zippedArchive: true
    }),

    // Webhook-specific logs
    new DailyRotateFile({
      filename: 'logs/webhooks-%DATE%.log',
      datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
      maxSize: process.env.LOG_MAX_SIZE || '100m',
      maxFiles: process.env.LOG_MAX_FILES || '30d',
      zippedArchive: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

// Message lifecycle logging helpers
class MessageLogger {
  constructor(messageId, userId = null) {
    this.messageId = messageId;
    this.userId = userId;
    this.startTime = Date.now();
  }

  logReceived(payload) {
    logger.info('Message received', {
      messageId: this.messageId,
      userId: this.userId,
      action: 'webhook_received',
      payload: {
        from: payload.From,
        body: payload.Body?.substring(0, 100),
        messageType: payload.MessageType
      }
    });
  }

  logValidated() {
    logger.info('Message validated', {
      messageId: this.messageId,
      userId: this.userId,
      action: 'signature_validated',
      duration: Date.now() - this.startTime
    });
  }

  logDeduped(isDuplicate) {
    if (isDuplicate) {
      logger.warn('Duplicate message rejected', {
        messageId: this.messageId,
        userId: this.userId,
        action: 'duplicate_rejected'
      });
    } else {
      logger.info('Message deduplication passed', {
        messageId: this.messageId,
        userId: this.userId,
        action: 'dedup_passed'
      });
    }
  }

  logEnqueued(queueName, jobId) {
    logger.info('Message enqueued', {
      messageId: this.messageId,
      userId: this.userId,
      action: 'message_enqueued',
      queueName,
      jobId,
      duration: Date.now() - this.startTime
    });
  }

  logProcessingStarted(workerType) {
    logger.info('Message processing started', {
      messageId: this.messageId,
      userId: this.userId,
      action: 'processing_started',
      workerType
    });
  }

  logProcessingCompleted(workerType, result) {
    logger.info('Message processing completed', {
      messageId: this.messageId,
      userId: this.userId,
      action: 'processing_completed',
      workerType,
      result: result?.action || 'unknown',
      duration: Date.now() - this.startTime
    });
  }

  logReplySent(phoneNumber, replyLength) {
    logger.info('Reply sent', {
      messageId: this.messageId,
      userId: this.userId,
      action: 'reply_sent',
      phoneNumber,
      replyLength,
      duration: Date.now() - this.startTime
    });
  }

  logError(error, context = {}) {
    logger.error('Message processing error', {
      messageId: this.messageId,
      userId: this.userId,
      action: 'processing_error',
      error: error.message,
      stack: error.stack,
      duration: Date.now() - this.startTime,
      ...context
    });
  }

  logRetry(attempt, maxAttempts, delay) {
    logger.warn('Message retry scheduled', {
      messageId: this.messageId,
      userId: this.userId,
      action: 'retry_scheduled',
      attempt,
      maxAttempts,
      delay
    });
  }

  logDeadLetter(reason) {
    logger.error('Message moved to dead letter queue', {
      messageId: this.messageId,
      userId: this.userId,
      action: 'moved_to_dlq',
      reason,
      duration: Date.now() - this.startTime
    });
  }
}

// Performance monitoring
class PerformanceLogger {
  static logWebhookResponse(messageId, statusCode, duration) {
    logger.info('Webhook response', {
      messageId,
      action: 'webhook_response',
      statusCode,
      duration,
      performance: {
        responseTime: duration,
        withinSLA: duration < 2000
      }
    });
  }

  static logQueueMetrics(queueName, metrics) {
    logger.info('Queue metrics', {
      action: 'queue_metrics',
      queueName,
      metrics: {
        waiting: metrics.waiting,
        active: metrics.active,
        completed: metrics.completed,
        failed: metrics.failed,
        delayed: metrics.delayed
      }
    });
  }

  static logWorkerMetrics(workerType, metrics) {
    logger.info('Worker metrics', {
      action: 'worker_metrics',
      workerType,
      metrics: {
        processed: metrics.processed,
        failed: metrics.failed,
        avgProcessingTime: metrics.avgProcessingTime
      }
    });
  }
}

// Alert logging
class AlertLogger {
  static logHighErrorRate(queueName, errorRate) {
    logger.error('High error rate detected', {
      action: 'high_error_rate_alert',
      queueName,
      errorRate,
      severity: 'critical'
    });
  }

  static logQueueBacklog(queueName, backlogSize) {
    logger.warn('Queue backlog detected', {
      action: 'queue_backlog_alert',
      queueName,
      backlogSize,
      severity: 'warning'
    });
  }

  static logWorkerDown(workerType) {
    logger.error('Worker down', {
      action: 'worker_down_alert',
      workerType,
      severity: 'critical'
    });
  }
}

module.exports = {
  logger,
  MessageLogger,
  PerformanceLogger,
  AlertLogger
};