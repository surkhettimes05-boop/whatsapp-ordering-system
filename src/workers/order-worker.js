const { Worker } = require('bullmq');
const { redisManager } = require('../infrastructure/redis');
const { logger, MessageLogger } = require('../infrastructure/logger');
const { MetricsCollector } = require('../monitoring/metrics');

class OrderWorker {
  constructor() {
    this.worker = null;
    this.metrics = new MetricsCollector();
    this.isShuttingDown = false;
  }

  async initialize() {
    const mainRedis = redisManager.getConnection('main');
    const queueName = process.env.ORDER_QUEUE_NAME || 'order-processing';

    this.worker = new Worker(queueName, this.processJob.bind(this), {
      connection: mainRedis,
      concurrency: parseInt(process.env.ORDER_WORKERS) || 3,
      maxStalledCount: 3,
      stalledInterval: 30000,
      removeOnComplete: 100,
      removeOnFail: 50
    });

    this.setupEventHandlers();
    
    logger.info('Order worker initialized', { 
      action: 'worker_initialized',
      workerType: 'order',
      concurrency: this.worker.opts.concurrency
    });
  }

  async processJob(job) {
    const { messageId, payload } = job.data;
    const messageLogger = new MessageLogger(messageId, this.extractUserId(payload));
    
    try {
      messageLogger.logProcessingStarted('order');
      
      const result = await this.processOrder(messageId, payload, messageLogger);
      
      messageLogger.logProcessingCompleted('order', result);
      this.metrics.incrementJobsProcessed('order');
      
      return result;
    } catch (error) {
      messageLogger.logError(error, { workerType: 'order' });
      this.metrics.incrementJobsFailed('order');
      throw error;
    }
  }

  async processOrder(messageId, payload, messageLogger) {
    const body = payload.Body?.toLowerCase().trim() || '';
    const from = payload.From;
    const phoneNumber = from.replace('whatsapp:', '');

    // Parse order from message
    const orderData = this.parseOrderMessage(body);
    
    if (!orderData.isValid) {
      return await this.handleInvalidOrder(messageId, payload, orderData.error, messageLogger);
    }

    // Process valid order
    const order = await this.createOrder(phoneNumber, orderData, messageLogger);
    
    // Enqueue vendor routing
    await this.enqueueVendorRouting(messageId, order, messageLogger);
    
    // Enqueue confirmation reply
    await this.enqueueOrderConfirmation(messageId, payload, order, messageLogger);

    return {
      action: 'order_processed',
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount
    };
  }

  parseOrderMessage(body) {
    try {
      // Handle different order formats
      if (body === 'order' || body === 'start order') {
        return {
          isValid: true,
          type: 'start_order',
          items: []
        };
      }

      // Parse format: "1x2, 3x1" (productId x quantity)
      const orderPattern = /(\d+)x(\d+)/g;
      const matches = [...body.matchAll(orderPattern)];
      
      if (matches.length === 0) {
        return {
          isValid: false,
          error: 'Invalid order format. Use: 1x2, 3x1 (product x quantity)'
        };
      }

      const items = matches.map(match => ({
        productId: match[1],
        quantity: parseInt(match[2])
      }));

      return {
        isValid: true,
        type: 'product_order',
        items
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'Failed to parse order message'
      };
    }
  }

  async createOrder(phoneNumber, orderData, messageLogger) {
    try {
      // Mock order creation - replace with actual database logic
      const orderNumber = `WO-${Date.now().toString().slice(-6)}`;
      
      if (orderData.type === 'start_order') {
        return {
          id: `order_${Date.now()}`,
          orderNumber,
          phoneNumber,
          status: 'STARTED',
          type: 'interactive',
          totalAmount: 0,
          items: []
        };
      }

      // Calculate order totals
      const products = await this.getProducts(orderData.items.map(item => item.productId));
      let totalAmount = 0;
      const orderItems = [];

      for (const item of orderData.items) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const subtotal = product.price * item.quantity;
          totalAmount += subtotal;
          orderItems.push({
            productId: item.productId,
            productName: product.name,
            quantity: item.quantity,
            price: product.price,
            subtotal
          });
        }
      }

      const order = {
        id: `order_${Date.now()}`,
        orderNumber,
        phoneNumber,
        status: 'CREATED',
        type: 'direct',
        totalAmount,
        items: orderItems,
        createdAt: new Date().toISOString()
      };

      // Log order creation
      logger.info('Order created', {
        action: 'order_created',
        orderId: order.id,
        orderNumber: order.orderNumber,
        phoneNumber,
        totalAmount,
        itemCount: orderItems.length
      });

      return order;
    } catch (error) {
      messageLogger.logError(error, { step: 'order_creation' });
      throw new Error(`Failed to create order: ${error.message}`);
    }
  }

  async getProducts(productIds) {
    // Mock product data - replace with actual database query
    const mockProducts = {
      '1': { id: '1', name: 'Rice (1kg)', price: 120 },
      '2': { id: '2', name: 'Dal (1kg)', price: 180 },
      '3': { id: '3', name: 'Oil (1L)', price: 200 },
      '4': { id: '4', name: 'Sugar (1kg)', price: 90 },
      '5': { id: '5', name: 'Tea (250g)', price: 150 },
      '6': { id: '6', name: 'Flour (1kg)', price: 80 },
      '7': { id: '7', name: 'Salt (1kg)', price: 25 },
      '8': { id: '8', name: 'Onion (1kg)', price: 60 }
    };

    return productIds.map(id => mockProducts[id]).filter(Boolean);
  }

  async handleInvalidOrder(messageId, payload, error, messageLogger) {
    // Enqueue error reply
    await this.enqueueErrorReply(messageId, payload, error, messageLogger);
    
    return {
      action: 'invalid_order',
      error
    };
  }

  async enqueueVendorRouting(messageId, order, messageLogger) {
    const { Queue } = require('bullmq');
    const mainRedis = redisManager.getConnection('main');
    const vendorQueue = new Queue(process.env.VENDOR_QUEUE_NAME || 'vendor-routing', {
      connection: mainRedis
    });

    const job = await vendorQueue.add('route-order', {
      messageId,
      orderId: order.id,
      order,
      routedAt: Date.now(),
      routedBy: 'order-worker'
    }, {
      priority: 3,
      delay: 1000 // Small delay to ensure order is saved
    });

    messageLogger.logEnqueued(process.env.VENDOR_QUEUE_NAME, job.id);
  }

  async enqueueOrderConfirmation(messageId, payload, order, messageLogger) {
    const { Queue } = require('bullmq');
    const mainRedis = redisManager.getConnection('main');
    const replyQueue = new Queue(process.env.REPLY_QUEUE_NAME || 'whatsapp-replies', {
      connection: mainRedis
    });

    const confirmationMessage = this.generateOrderConfirmation(order);

    const job = await replyQueue.add('send-reply', {
      messageId: `${messageId}_confirmation`,
      payload: {
        ...payload,
        replyMessage: confirmationMessage,
        replyType: 'order_confirmation'
      },
      routedAt: Date.now(),
      routedBy: 'order-worker'
    }, {
      priority: 5,
      delay: 500
    });

    messageLogger.logEnqueued(process.env.REPLY_QUEUE_NAME, job.id);
  }

  async enqueueErrorReply(messageId, payload, error, messageLogger) {
    const { Queue } = require('bullmq');
    const mainRedis = redisManager.getConnection('main');
    const replyQueue = new Queue(process.env.REPLY_QUEUE_NAME || 'whatsapp-replies', {
      connection: mainRedis
    });

    const errorMessage = `❌ ${error}\n\n💡 Try:\n• "order" to start ordering\n• "1x2, 3x1" for 2kg rice + 1L oil\n• "menu" to see products`;

    const job = await replyQueue.add('send-reply', {
      messageId: `${messageId}_error`,
      payload: {
        ...payload,
        replyMessage: errorMessage,
        replyType: 'error'
      },
      routedAt: Date.now(),
      routedBy: 'order-worker'
    }, {
      priority: 8,
      delay: 0
    });

    messageLogger.logEnqueued(process.env.REPLY_QUEUE_NAME, job.id);
  }

  generateOrderConfirmation(order) {
    if (order.type === 'interactive') {
      return `🛒 *Order Started!*\n\n📋 *Available Products:*\n\n1️⃣ Rice (1kg) - Rs. 120\n2️⃣ Dal (1kg) - Rs. 180\n3️⃣ Oil (1L) - Rs. 200\n4️⃣ Sugar (1kg) - Rs. 90\n5️⃣ Tea (250g) - Rs. 150\n6️⃣ Flour (1kg) - Rs. 80\n7️⃣ Salt (1kg) - Rs. 25\n8️⃣ Onion (1kg) - Rs. 60\n\n💡 *How to order:*\nType: product_number x quantity\nExample: "1x2, 3x1" for 2kg rice and 1L oil`;
    }

    let message = `✅ *Order Confirmed!*\n\n📋 Order #${order.orderNumber}\n\n`;
    
    order.items.forEach(item => {
      message += `${item.productName} x${item.quantity} = Rs. ${item.subtotal}\n`;
    });
    
    message += `\n💰 *Total: Rs. ${order.totalAmount}*\n\n🚚 Your order has been sent to nearby wholesalers.\n📱 You'll receive updates on vendor acceptance and delivery time.\n\n🙏 Thank you for using our service!`;
    
    return message;
  }

  extractUserId(payload) {
    return payload.WaId || payload.From?.replace('whatsapp:', '') || null;
  }

  setupEventHandlers() {
    this.worker.on('completed', (job, result) => {
      logger.info('Order job completed', {
        action: 'job_completed',
        workerType: 'order',
        jobId: job.id,
        messageId: job.data.messageId,
        result: result?.action,
        orderId: result?.orderId,
        duration: Date.now() - job.processedOn
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Order job failed', {
        action: 'job_failed',
        workerType: 'order',
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
      logger.warn('Order job stalled', {
        action: 'job_stalled',
        workerType: 'order',
        jobId
      });
    });

    this.worker.on('error', (error) => {
      logger.error('Order worker error', {
        action: 'worker_error',
        workerType: 'order',
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
        originalQueue: process.env.ORDER_QUEUE_NAME,
        originalJobId: job.id,
        messageId: job.data.messageId,
        payload: job.data.payload,
        error: error.message,
        failedAt: Date.now(),
        attemptsMade: job.attemptsMade
      });

      const messageLogger = new MessageLogger(job.data.messageId);
      messageLogger.logDeadLetter(`Order processing failed: ${error.message}`);

    } catch (dlqError) {
      logger.error('Failed to move order job to dead letter queue', {
        action: 'dlq_error',
        jobId: job.id,
        error: dlqError.message
      });
    }
  }

  async start() {
    await this.initialize();
    logger.info('Order worker started', { 
      action: 'worker_started',
      workerType: 'order'
    });
  }

  async shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info('Shutting down order worker', { 
      action: 'worker_shutdown',
      workerType: 'order'
    });

    if (this.worker) {
      await this.worker.close();
    }

    logger.info('Order worker shutdown complete', { 
      action: 'worker_shutdown_complete',
      workerType: 'order'
    });
  }
}

module.exports = OrderWorker;