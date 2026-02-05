const express = require('express');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const { Queue } = require('bullmq');
const { v4: uuidv4 } = require('uuid');

const { redisManager, MessageDeduplicator } = require('../infrastructure/redis');
const { logger, MessageLogger, PerformanceLogger } = require('../infrastructure/logger');
const { MetricsCollector } = require('../monitoring/metrics');

require('dotenv').config();

class WebhookGateway {
  constructor() {
    this.app = express();
    this.queues = new Map();
    this.deduplicator = null;
    this.metrics = new MetricsCollector();
    this.setupMiddleware();
    this.setupRoutes();
  }

  async initialize() {
    // Initialize Redis connections
    await redisManager.initializeConnections();
    
    // Setup deduplication
    const cacheRedis = redisManager.getConnection('cache');
    this.deduplicator = new MessageDeduplicator(cacheRedis);

    // Initialize queues
    await this.initializeQueues();

    logger.info('Webhook gateway initialized', { action: 'gateway_initialized' });
  }

  setupMiddleware() {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: false, // Allow Twilio webhooks
      crossOriginEmbedderPolicy: false
    }));

    // Rate limiting
    const webhookLimiter = rateLimit({
      windowMs: parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW) || 60000,
      max: parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX) || 100,
      message: {
        error: 'Too many webhook requests',
        retryAfter: Math.ceil((parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW) || 60000) / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Skip rate limiting for successful requests if configured
        return process.env.WEBHOOK_RATE_LIMIT_SKIP_SUCCESS === 'true' && req.webhookSuccess;
      }
    });

    this.app.use('/webhook', webhookLimiter);

    // Body parsing with size limits
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Request timeout
    this.app.use((req, res, next) => {
      const timeout = parseInt(process.env.WEBHOOK_TIMEOUT) || 2000;
      req.setTimeout(timeout, () => {
        logger.error('Webhook request timeout', { 
          action: 'webhook_timeout',
          url: req.url,
          timeout 
        });
        if (!res.headersSent) {
          res.status(408).json({ error: 'Request timeout' });
        }
      });
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      req.startTime = Date.now();
      req.requestId = uuidv4();
      
      logger.info('Webhook request received', {
        action: 'webhook_request',
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        contentLength: req.get('Content-Length')
      });

      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', async (req, res) => {
      try {
        const redisHealth = await redisManager.healthCheck();
        const queueHealth = await this.checkQueueHealth();
        
        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            redis: redisHealth,
            queues: queueHealth
          }
        };

        res.json(health);
      } catch (error) {
        logger.error('Health check failed', { 
          action: 'health_check_failed',
          error: error.message 
        });
        res.status(503).json({ 
          status: 'unhealthy', 
          error: error.message 
        });
      }
    });

    // Main webhook endpoint
    this.app.post('/webhook/whatsapp', async (req, res) => {
      const startTime = Date.now();
      let messageLogger = null;

      try {
        // Extract message ID
        const messageId = req.body.MessageSid || req.body.SmsMessageSid || uuidv4();
        const userId = this.extractUserId(req.body);
        
        messageLogger = new MessageLogger(messageId, userId);
        messageLogger.logReceived(req.body);

        // Validate webhook signature
        if (!await this.verifySignature(req)) {
          messageLogger.logError(new Error('Invalid signature'), { step: 'signature_verification' });
          return res.status(403).json({ error: 'Invalid signature' });
        }
        messageLogger.logValidated();

        // Validate payload
        const validationResult = this.validatePayload(req.body);
        if (validationResult.error) {
          messageLogger.logError(validationResult.error, { step: 'payload_validation' });
          return res.status(400).json({ error: validationResult.error.message });
        }

        // Check for duplicates
        const isDuplicate = await this.deduplicator.isDuplicate(messageId);
        messageLogger.logDeduped(isDuplicate);
        
        if (isDuplicate) {
          req.webhookSuccess = true; // Skip rate limiting for duplicates
          return res.json({ 
            success: true, 
            message: 'Duplicate message ignored',
            messageId 
          });
        }

        // Enqueue message for processing
        const jobId = await this.enqueueMessage(messageId, req.body);
        messageLogger.logEnqueued(process.env.WEBHOOK_QUEUE_NAME, jobId);

        // Update metrics
        this.metrics.incrementWebhookReceived();
        
        const duration = Date.now() - startTime;
        PerformanceLogger.logWebhookResponse(messageId, 200, duration);

        req.webhookSuccess = true;
        res.json({ 
          success: true, 
          message: 'Message queued for processing',
          messageId,
          jobId 
        });

      } catch (error) {
        const duration = Date.now() - startTime;
        
        if (messageLogger) {
          messageLogger.logError(error, { step: 'webhook_processing' });
        } else {
          logger.error('Webhook processing error', { 
            action: 'webhook_error',
            requestId: req.requestId,
            error: error.message,
            stack: error.stack 
          });
        }

        this.metrics.incrementWebhookErrors();
        PerformanceLogger.logWebhookResponse(req.requestId, 500, duration);

        res.status(500).json({ 
          success: false, 
          error: 'Internal server error',
          requestId: req.requestId 
        });
      }
    });

    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      try {
        const metrics = await this.metrics.getMetrics();
        res.set('Content-Type', 'text/plain');
        res.send(metrics);
      } catch (error) {
        logger.error('Metrics endpoint error', { 
          action: 'metrics_error',
          error: error.message 
        });
        res.status(500).json({ error: 'Failed to get metrics' });
      }
    });
  }

  async initializeQueues() {
    const mainRedis = redisManager.getConnection('main');
    
    const queueNames = [
      process.env.WEBHOOK_QUEUE_NAME || 'whatsapp-webhooks',
      process.env.ORDER_QUEUE_NAME || 'order-processing',
      process.env.VENDOR_QUEUE_NAME || 'vendor-routing',
      process.env.REPLY_QUEUE_NAME || 'whatsapp-replies',
      process.env.DLQ_QUEUE_NAME || 'dead-letter-queue'
    ];

    for (const queueName of queueNames) {
      const queue = new Queue(queueName, {
        connection: mainRedis,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: parseInt(process.env.MAX_RETRY_ATTEMPTS) || 5,
          backoff: {
            type: process.env.RETRY_BACKOFF_TYPE || 'exponential',
            delay: parseInt(process.env.RETRY_BACKOFF_DELAY) || 2000,
            settings: {
              multiplier: parseInt(process.env.RETRY_BACKOFF_MULTIPLIER) || 2,
              maxDelay: parseInt(process.env.RETRY_MAX_DELAY) || 30000
            }
          }
        }
      });

      this.queues.set(queueName, queue);
      logger.info(`Queue initialized: ${queueName}`, { 
        action: 'queue_initialized',
        queueName 
      });
    }
  }

  async verifySignature(req) {
    if (process.env.WEBHOOK_SIGNATURE_VERIFICATION !== 'true') {
      return true; // Skip verification in development
    }

    try {
      const signature = req.headers['x-twilio-signature'];
      if (!signature) {
        logger.warn('Missing Twilio signature', { 
          action: 'missing_signature',
          requestId: req.requestId 
        });
        return false;
      }

      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const body = req.rawBody || JSON.stringify(req.body);

      const expectedSignature = crypto
        .createHmac('sha1', authToken)
        .update(url + body)
        .digest('base64');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (!isValid) {
        logger.warn('Invalid Twilio signature', { 
          action: 'invalid_signature',
          requestId: req.requestId,
          expectedSignature: expectedSignature.substring(0, 10) + '...',
          receivedSignature: signature.substring(0, 10) + '...'
        });
      }

      return isValid;
    } catch (error) {
      logger.error('Signature verification error', { 
        action: 'signature_verification_error',
        requestId: req.requestId,
        error: error.message 
      });
      return false;
    }
  }

  validatePayload(payload) {
    const schema = Joi.object({
      MessageSid: Joi.string().required(),
      From: Joi.string().required(),
      To: Joi.string().required(),
      Body: Joi.string().allow('').required(),
      MessageType: Joi.string().default('text'),
      NumMedia: Joi.string().default('0'),
      ProfileName: Joi.string().optional(),
      WaId: Joi.string().optional()
    }).unknown(true); // Allow additional Twilio fields

    return schema.validate(payload);
  }

  extractUserId(payload) {
    // Extract user ID from WhatsApp ID or phone number
    return payload.WaId || payload.From?.replace('whatsapp:', '') || null;
  }

  async enqueueMessage(messageId, payload) {
    const webhookQueue = this.queues.get(process.env.WEBHOOK_QUEUE_NAME);
    
    const job = await webhookQueue.add('process-webhook', {
      messageId,
      payload,
      receivedAt: Date.now()
    }, {
      jobId: messageId, // Use messageId as jobId for deduplication
      priority: this.calculatePriority(payload),
      delay: 0
    });

    return job.id;
  }

  calculatePriority(payload) {
    // Higher priority for certain message types
    const body = payload.Body?.toLowerCase() || '';
    
    if (body.includes('urgent') || body.includes('emergency')) return 1;
    if (body.includes('order') || body.includes('confirm')) return 5;
    return 10; // Default priority
  }

  async checkQueueHealth() {
    const health = {};
    
    for (const [name, queue] of this.queues) {
      try {
        const counts = await queue.getJobCounts();
        health[name] = {
          status: 'healthy',
          counts
        };
      } catch (error) {
        health[name] = {
          status: 'unhealthy',
          error: error.message
        };
      }
    }

    return health;
  }

  async start() {
    await this.initialize();
    
    const port = process.env.GATEWAY_PORT || 3010;
    this.server = this.app.listen(port, () => {
      logger.info(`Webhook gateway started on port ${port}`, { 
        action: 'gateway_started',
        port 
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  async shutdown() {
    logger.info('Shutting down webhook gateway', { action: 'gateway_shutdown' });
    
    if (this.server) {
      this.server.close();
    }

    // Close all queues
    for (const queue of this.queues.values()) {
      await queue.close();
    }

    await redisManager.shutdown();
    
    logger.info('Webhook gateway shutdown complete', { action: 'gateway_shutdown_complete' });
    process.exit(0);
  }
}

// Start gateway if run directly
if (require.main === module) {
  const gateway = new WebhookGateway();
  gateway.start().catch(error => {
    logger.error('Failed to start webhook gateway', { 
      action: 'gateway_start_failed',
      error: error.message 
    });
    process.exit(1);
  });
}

module.exports = WebhookGateway;