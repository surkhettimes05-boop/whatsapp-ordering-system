const { Worker } = require('bullmq');
const twilio = require('twilio');
const { redisManager } = require('../infrastructure/redis');
const { logger, MessageLogger } = require('../infrastructure/logger');
const { MetricsCollector } = require('../monitoring/metrics');

class ReplyWorker {
  constructor() {
    this.worker = null;
    this.twilioClient = null;
    this.metrics = new MetricsCollector();
    this.isShuttingDown = false;
    this.initializeTwilio();
  }

  initializeTwilio() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (accountSid && authToken) {
      this.twilioClient = twilio(accountSid, authToken);
      logger.info('Twilio client initialized for reply worker', { 
        action: 'twilio_initialized',
        workerType: 'reply'
      });
    } else {
      logger.warn('Twilio credentials not found, running in mock mode', { 
        action: 'twilio_mock_mode',
        workerType: 'reply'
      });
    }
  }

  async initialize() {
    const mainRedis = redisManager.getConnection('main');
    const queueName = process.env.REPLY_QUEUE_NAME || 'whatsapp-replies';

    this.worker = new Worker(queueName, this.processJob.bind(this), {
      connection: mainRedis,
      concurrency: parseInt(process.env.REPLY_WORKERS) || 4,
      maxStalledCount: 3,
      stalledInterval: 30000,
      removeOnComplete: 100,
      removeOnFail: 50
    });

    this.setupEventHandlers();
    
    logger.info('Reply worker initialized', { 
      action: 'worker_initialized',
      workerType: 'reply',
      concurrency: this.worker.opts.concurrency
    });
  }

  async processJob(job) {
    const { messageId, payload } = job.data;
    const messageLogger = new MessageLogger(messageId, this.extractUserId(payload));
    
    try {
      messageLogger.logProcessingStarted('reply');
      
      const result = await this.sendReply(messageId, payload, messageLogger);
      
      messageLogger.logProcessingCompleted('reply', result);
      this.metrics.incrementJobsProcessed('reply');
      
      return result;
    } catch (error) {
      messageLogger.logError(error, { workerType: 'reply' });
      this.metrics.incrementJobsFailed('reply');
      throw error;
    }
  }

  async sendReply(messageId, payload, messageLogger) {
    const phoneNumber = payload.From?.replace('whatsapp:', '') || '';
    
    // Get reply message
    let replyMessage;
    if (payload.replyMessage) {
      // Pre-generated reply from other workers
      replyMessage = payload.replyMessage;
    } else {
      // Generate reply based on original message
      replyMessage = await this.generateReply(payload);
    }

    if (!replyMessage) {
      logger.warn('No reply message generated', {
        action: 'no_reply_generated',
        messageId,
        phoneNumber
      });
      return { action: 'no_reply' };
    }

    // Send reply via Twilio
    const sendResult = await this.sendWhatsAppMessage(phoneNumber, replyMessage);
    
    if (sendResult.success) {
      messageLogger.logReplySent(phoneNumber, replyMessage.length);
      this.metrics.incrementRepliesSent();
      
      return {
        action: 'reply_sent',
        phoneNumber,
        messageLength: replyMessage.length,
        twilioSid: sendResult.sid
      };
    } else {
      throw new Error(`Failed to send reply: ${sendResult.error}`);
    }
  }

  async generateReply(payload) {
    const body = payload.Body?.toLowerCase().trim() || '';
    const messageType = payload.replyType || 'general';

    // Handle different message types
    switch (messageType) {
      case 'order_confirmation':
        return payload.replyMessage; // Already generated
      case 'error':
        return payload.replyMessage; // Already generated
      default:
        return this.generateGeneralReply(body);
    }
  }

  generateGeneralReply(body) {
    // Simple command routing for general replies
    if (body.includes('hello') || body.includes('hi')) {
      return `🙏 *Welcome to WhatsApp Ordering!*\n\n🛒 I can help you order groceries from local wholesalers.\n\n📋 *Quick Commands:*\n• Type "order" to start ordering\n• Type "menu" to see products\n• Type "status" to check orders\n• Type "help" for more info\n\n🌐 *Supported Languages:*\nEnglish | नेपाली`;
    }

    if (body === 'menu') {
      return `📋 *Product Menu:*\n\n1️⃣ Rice (1kg) - Rs. 120\n2️⃣ Dal (1kg) - Rs. 180\n3️⃣ Oil (1L) - Rs. 200\n4️⃣ Sugar (1kg) - Rs. 90\n5️⃣ Tea (250g) - Rs. 150\n6️⃣ Flour (1kg) - Rs. 80\n7️⃣ Salt (1kg) - Rs. 25\n8️⃣ Onion (1kg) - Rs. 60\n\n💡 Type "order" to start ordering`;
    }

    if (body === 'status') {
      return `📊 *Your Orders:*\n\n🚚 Order #WO-123456\nStatus: Out for Delivery\nVendor: Kathmandu Wholesale\nExpected: Today 6:00 PM\n\n📦 Order #WO-123457\nStatus: Processing\nVendor: Valley Traders\nExpected: Tomorrow 2:00 PM\n\n💡 Type "order" to place a new order`;
    }

    if (body === 'help') {
      return `🤖 *WhatsApp Ordering Help*\n\n📋 *Commands:*\n• "order" - Start new order\n• "menu" - View products\n• "status" - Check orders\n• "help" - Show this help\n\n🌐 *Languages:*\n• English\n• नेपाली (Nepali)\n\n💡 *How to Order:*\n1. Type "order"\n2. Use format: 1x2, 3x1\n3. Confirm your order\n\n📞 *Support:* +977-9800000000`;
    }

    // Default response
    return `🤖 I didn't understand that.\n\n📋 Try these commands:\n• "hello" - Welcome message\n• "menu" - View products\n• "order" - Start ordering\n• "status" - Check orders\n• "help" - Get help`;
  }

  async sendWhatsAppMessage(phoneNumber, message) {
    if (!this.twilioClient) {
      // Mock mode
      logger.info('Mock WhatsApp message sent', {
        action: 'mock_message_sent',
        phoneNumber,
        messageLength: message.length,
        preview: message.substring(0, 50) + '...'
      });
      return { success: true, mock: true };
    }

    try {
      const whatsappNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
      
      const response = await this.twilioClient.messages.create({
        body: message,
        from: whatsappNumber,
        to: `whatsapp:${phoneNumber}`
      });

      logger.info('WhatsApp message sent via Twilio', {
        action: 'twilio_message_sent',
        phoneNumber,
        messageLength: message.length,
        twilioSid: response.sid,
        status: response.status
      });

      return { 
        success: true, 
        sid: response.sid,
        status: response.status
      };
    } catch (error) {
      logger.error('Failed to send WhatsApp message via Twilio', {
        action: 'twilio_send_failed',
        phoneNumber,
        error: error.message,
        errorCode: error.code
      });

      return { 
        success: false, 
        error: error.message,
        errorCode: error.code
      };
    }
  }

  extractUserId(payload) {
    return payload.WaId || payload.From?.replace('whatsapp:', '') || null;
  }

  setupEventHandlers() {
    this.worker.on('completed', (job, result) => {
      logger.info('Reply job completed', {
        action: 'job_completed',
        workerType: 'reply',
        jobId: job.id,
        messageId: job.data.messageId,
        result: result?.action,
        phoneNumber: result?.phoneNumber,
        duration: Date.now() - job.processedOn
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Reply job failed', {
        action: 'job_failed',
        workerType: 'reply',
        jobId: job?.id,
        messageId: job?.data?.messageId,
        error: error.message,
        attemptsMade: job?.attemptsMade
      });

      if (job && job.attemptsMade >= (job.opts.attempts || 5)) {
        this.moveToDeadLetterQueue(job, error);
      }
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn('Reply job stalled', {
        action: 'job_stalled',
        workerType: 'reply',
        jobId
      });
    });

    this.worker.on('error', (error) => {
      logger.error('Reply worker error', {
        action: 'worker_error',
        workerType: 'reply',
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
        originalQueue: process.env.REPLY_QUEUE_NAME,
        originalJobId: job.id,
        messageId: job.data.messageId,
        payload: job.data.payload,
        error: error.message,
        failedAt: Date.now(),
        attemptsMade: job.attemptsMade
      });

      const messageLogger = new MessageLogger(job.data.messageId);
      messageLogger.logDeadLetter(`Reply sending failed: ${error.message}`);

    } catch (dlqError) {
      logger.error('Failed to move reply job to dead letter queue', {
        action: 'dlq_error',
        jobId: job.id,
        error: dlqError.message
      });
    }
  }

  async start() {
    await this.initialize();
    logger.info('Reply worker started', { 
      action: 'worker_started',
      workerType: 'reply'
    });
  }

  async shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info('Shutting down reply worker', { 
      action: 'worker_shutdown',
      workerType: 'reply'
    });

    if (this.worker) {
      await this.worker.close();
    }

    logger.info('Reply worker shutdown complete', { 
      action: 'worker_shutdown_complete',
      workerType: 'reply'
    });
  }
}

module.exports = ReplyWorker;