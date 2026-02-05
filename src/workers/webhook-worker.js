const { Worker } = require('bullmq');
const { redisManager } = require('../infrastructure/redis');
const { logger, MessageLogger } = require('../infrastructure/logger');
const { MetricsCollector } = require('../monitoring/metrics');

class WebhookWorker {
  constructor() {
    this.worker = null;
    this.metrics = new MetricsCollector();
    this.isShuttingDown = false;
  }

  async initialize() {
    const mainRedis = redisManager.getConnection('main');
    const queueName = process.env.WEBHOOK_QUEUE_NAME || 'whatsapp-webhooks';

    this.worker = new Worker(queueName, this.processJob.bind(this), {
      connection: mainRedis,
      concurrency: parseInt(process.env.WEBHOOK_WORKERS) || 2,
      maxStalledCount: 3,
      stalledInterval: 30000,
      removeOnComplete: 100,
      removeOnFail: 50
    });

    this.setupEventHandlers();
    
    logger.info('Webhook worker initialized', { 
      action: 'worker_initialized',
      workerType: 'webhook',
      concurrency: this.worker.opts.concurrency
    });
  }

  async processJob(job) {
    const { messageId, payload } = job.data;
    const messageLogger = new MessageLogger(messageId, this.extractUserId(payload));
    
    try {
      messageLogger.logProcessingStarted('webhook');
      
      // Route message to appropriate processor
      const result = await this.routeMessage(messageId, payload, messageLogger);
      
      messageLogger.logProcessingCompleted('webhook', result);
      this.metrics.incrementJobsProcessed('webhook');
      
      return result;
    } catch (error) {
      messageLogger.logError(error, { workerType: 'webhook' });
      this.metrics.incrementJobsFailed('webhook');
      throw error;
    }
  }

  async routeMessage(messageId, payload, messageLogger) {
    const body = payload.Body?.toLowerCase().trim() || '';
    const from = payload.From;
    
    // Determine message type and route accordingly
    if (this.isOrderMessage(body)) {
      return await this.enqueueOrderProcessing(messageId, payload, messageLogger);
    } else if (this.isVendorMessage(body)) {
      return await this.enqueueVendorRouting(messageId, payload, messageLogger);
    } else {
      return await this.enqueueReply(messageId, payload, messageLogger);
    }
  }

  isOrderMessage(body) {
    const orderKeywords = ['order', 'buy', 'purchase', 'confirm', /\d+x\d+/];
    return orderKeywords.some(keyword => 
      typeof keyword === 'string' ? body.includes(keyword) : keyword.test(body)
    );
  }

  isVendorMessage(body) {
    const vendorKeywords = ['vendor', 'supplier', 'wholesale', 'stock'];
    return vendorKeywords.some(keyword => body.includes(keyword));
  }

  async enqueueOrderProcessing(messageId, payload, messageLogger) {
    const { Queue } = require('bullmq');
    const mainRedis = redisManager.getConnection('main');
    const orderQueue = new Queue(process.env.ORDER_QUEUE_NAME || 'order-processing', {
      connection: mainRedis
    });

    const job = await orderQueue.add('process-order', {
      messageId,
      payload,
      routedAt: Date.now(),
      routedBy: 'webhook-worker'
    }, {
      priority: 5,
      delay: 0
    });

    messageLogger.logEnqueued(process.env.ORDER_QUEUE_NAME, job.id);
    
    return {
      action: 'order_enqueued',
      targetQueue: process.env.ORDER_QUEUE_NAME,
      jobId: job.id
    };
  }

  async enqueueVendorRouting(messageId, payload, messageLogger) {
    const { Queue } = require('bullmq');
    const mainRedis = redisManager.getConnection('main');
    const vendorQueue = new Queue(process.env.VENDOR_QUEUE_NAME || 'vendor-routing', {
      connection: mainRedis
    });

    const job = await vendorQueue.add('route-vendor', {
      messageId,
      payload,
      routedAt: Date.now(),
      routedBy: 'webhook-worker'
    }, {
      priority: 7,
      delay: 0
    });

    messageLogger.logEnqueued(process.env.VENDOR_QUEUE_NAME, job.id);
    
    return {
      action: 'vendor_enqueued',
      targetQueue: process.env.VENDOR_QUEUE_NAME,
      jobId: job.id
    };
  }

  async enqueueReply(messageId, payload, messageLogger) {
    const { Queue } = require('bullmq');
    const mainRedis = redisManager.getConnection('main');
    const replyQueue = new Queue(process.env.REPLY_QUEUE_NAME || 'whatsapp-replies', {
      connection: mainRedis
    });

    const job = await replyQueue.add('send-reply', {
      messageId,
      payload,
      routedAt: Date.now(),
      routedBy: 'webhook-worker'
    }, {
      priority: 10,
      delay: 0
    });

    messageLogger.logEnqueued(process.env.REPLY_QUEUE_NAME, job.id);
    
    return {
      action: 'reply_enqueued',
      targetQueue: process.env.REPLY_QUEUE_NAME,
      jobId: job.id
    };
  }

  extractUserId(payload) {
    return payload.WaId || payload.From?.replace('whatsapp:', '') || null;
  }

  setupEventHandlers() {
    this.worker.on('completed', (job, result) => {
      logger.info('Webhook job completed', {
        action: 'job_completed',
        workerType: 'webhook',
        jobId: job.id,
        messageId: job.data.messageId,
        result: result?.action,
        duration: Date.now() - job.processedOn
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Webhook job failed', {
        action: 'job_failed',
        workerType: 'webhook',
        jobId: job?.id,
        messageId: job?.data?.messageId,
        error: error.message,
        attemptsMade: job?.attemptsMade,
        attemptsLeft: (job?.opts?.attempts || 0) - (job?.attemptsMade || 0)
      });

      // Move to dead letter queue if max attempts reached
      if (job && job.attemptsMade >= (job.opts.attempts || 5)) {
        this.moveToDeadLetterQueue(job, error);
      }
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn('Webhook job stalled', {
        action: 'job_stalled',
        workerType: 'webhook',
        jobId
      });
    });

    this.worker.on('error', (error) => {
      logger.error('Webhook worker error', {
        action: 'worker_error',
        workerType: 'webhook',
        error: error.message
      });
    });
  }

  async moveToDeadLetterQueue(job, error) {
    try {
      const { Queue } = require('bullmq');
      const mainRedis = redisManager.getConnection('main');
      const dlq = new Queue(process.env.DLQ_QUEUE_NAME || 'dead-letter-queue', {
        connection: mainRedis
      });

      await dlq.add('dead-letter', {
        originalQueue: process.env.WEBHOOK_QUEUE_NAME,
        originalJobId: job.id,
        messageId: job.data.messageId,
        payload: job.data.payload,
        error: error.message,
        failedAt: Date.now(),
        attemptsMade: job.attemptsMade
      });

      const messageLogger = new MessageLogger(job.data.messageId);
      messageLogger.logDeadLetter(`Max attempts reached: ${error.message}`);

    } catch (dlqError) {
      logger.error('Failed to move job to dead letter queue', {
        action: 'dlq_error',
        jobId: job.id,
        error: dlqError.message
      });
    }
  }

  async start() {
    await this.initialize();
    logger.info('Webhook worker started', { 
      action: 'worker_started',
      workerType: 'webhook'
    });
  }

  async shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info('Shutting down webhook worker', { 
      action: 'worker_shutdown',
      workerType: 'webhook'
    });

    if (this.worker) {
      await this.worker.close();
    }

    logger.info('Webhook worker shutdown complete', { 
      action: 'worker_shutdown_complete',
      workerType: 'webhook'
    });
  }
}

module.exports = WebhookWorker;