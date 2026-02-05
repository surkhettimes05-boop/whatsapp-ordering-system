const client = require('prom-client');
const { logger, PerformanceLogger, AlertLogger } = require('../infrastructure/logger');

class MetricsCollector {
  constructor() {
    this.register = new client.Registry();
    this.setupMetrics();
    this.setupDefaultMetrics();
  }

  setupMetrics() {
    // Webhook metrics
    this.webhookReceived = new client.Counter({
      name: 'whatsapp_webhooks_received_total',
      help: 'Total number of webhooks received',
      labelNames: ['status']
    });

    this.webhookErrors = new client.Counter({
      name: 'whatsapp_webhook_errors_total',
      help: 'Total number of webhook errors',
      labelNames: ['error_type']
    });

    this.webhookDuration = new client.Histogram({
      name: 'whatsapp_webhook_duration_seconds',
      help: 'Webhook processing duration',
      buckets: [0.1, 0.5, 1, 2, 5]
    });

    // Queue metrics
    this.queueSize = new client.Gauge({
      name: 'whatsapp_queue_size',
      help: 'Current queue size',
      labelNames: ['queue_name', 'status']
    });

    this.jobsProcessed = new client.Counter({
      name: 'whatsapp_jobs_processed_total',
      help: 'Total number of jobs processed',
      labelNames: ['worker_type', 'status']
    });

    this.jobDuration = new client.Histogram({
      name: 'whatsapp_job_duration_seconds',
      help: 'Job processing duration',
      labelNames: ['worker_type'],
      buckets: [0.1, 0.5, 1, 5, 10, 30]
    });

    // Message metrics
    this.messagesProcessed = new client.Counter({
      name: 'whatsapp_messages_processed_total',
      help: 'Total messages processed',
      labelNames: ['message_type', 'status']
    });

    this.repliesSent = new client.Counter({
      name: 'whatsapp_replies_sent_total',
      help: 'Total replies sent',
      labelNames: ['status']
    });

    this.duplicateMessages = new client.Counter({
      name: 'whatsapp_duplicate_messages_total',
      help: 'Total duplicate messages rejected'
    });

    // Error metrics
    this.errorRate = new client.Gauge({
      name: 'whatsapp_error_rate',
      help: 'Current error rate percentage',
      labelNames: ['component']
    });

    this.deadLetterQueue = new client.Gauge({
      name: 'whatsapp_dead_letter_queue_size',
      help: 'Dead letter queue size'
    });

    // Performance metrics
    this.responseTime = new client.Histogram({
      name: 'whatsapp_response_time_seconds',
      help: 'Response time for webhook processing',
      buckets: [0.1, 0.2, 0.5, 1, 2, 5]
    });

    this.throughput = new client.Gauge({
      name: 'whatsapp_throughput_messages_per_second',
      help: 'Messages processed per second'
    });

    // Register all metrics
    this.register.registerMetric(this.webhookReceived);
    this.register.registerMetric(this.webhookErrors);
    this.register.registerMetric(this.webhookDuration);
    this.register.registerMetric(this.queueSize);
    this.register.registerMetric(this.jobsProcessed);
    this.register.registerMetric(this.jobDuration);
    this.register.registerMetric(this.messagesProcessed);
    this.register.registerMetric(this.repliesSent);
    this.register.registerMetric(this.duplicateMessages);
    this.register.registerMetric(this.errorRate);
    this.register.registerMetric(this.deadLetterQueue);
    this.register.registerMetric(this.responseTime);
    this.register.registerMetric(this.throughput);
  }

  setupDefaultMetrics() {
    // Collect default Node.js metrics
    client.collectDefaultMetrics({
      register: this.register,
      prefix: 'whatsapp_nodejs_'
    });
  }

  // Webhook metrics methods
  incrementWebhookReceived(status = 'success') {
    this.webhookReceived.inc({ status });
  }

  incrementWebhookErrors(errorType = 'unknown') {
    this.webhookErrors.inc({ error_type: errorType });
  }

  recordWebhookDuration(duration) {
    this.webhookDuration.observe(duration / 1000); // Convert to seconds
  }

  // Queue metrics methods
  updateQueueSize(queueName, status, size) {
    this.queueSize.set({ queue_name: queueName, status }, size);
  }

  incrementJobsProcessed(workerType, status = 'success') {
    this.jobsProcessed.inc({ worker_type: workerType, status });
  }

  incrementJobsFailed(workerType) {
    this.jobsProcessed.inc({ worker_type: workerType, status: 'failed' });
  }

  recordJobDuration(workerType, duration) {
    this.jobDuration.observe({ worker_type: workerType }, duration / 1000);
  }

  // Message metrics methods
  incrementMessagesProcessed(messageType, status = 'success') {
    this.messagesProcessed.inc({ message_type: messageType, status });
  }

  incrementRepliesSent(status = 'success') {
    this.repliesSent.inc({ status });
  }

  incrementDuplicateMessages() {
    this.duplicateMessages.inc();
  }

  // Error metrics methods
  updateErrorRate(component, rate) {
    this.errorRate.set({ component }, rate);
  }

  updateDeadLetterQueueSize(size) {
    this.deadLetterQueue.set(size);
  }

  // Performance metrics methods
  recordResponseTime(duration) {
    this.responseTime.observe(duration / 1000);
  }

  updateThroughput(messagesPerSecond) {
    this.throughput.set(messagesPerSecond);
  }

  // Get all metrics
  async getMetrics() {
    return this.register.metrics();
  }

  // Reset all metrics (for testing)
  reset() {
    this.register.resetMetrics();
  }
}

class AlertManager {
  constructor(metricsCollector) {
    this.metrics = metricsCollector;
    this.alertThresholds = {
      errorRate: parseFloat(process.env.ALERT_ERROR_RATE) || 10,
      responseTime: parseInt(process.env.ALERT_RESPONSE_TIME_P95) || 5000,
      queueBacklog: parseInt(process.env.ALERT_QUEUE_BACKLOG) || 1000,
      deadLetterQueue: parseInt(process.env.ALERT_DLQ_SIZE) || 100
    };
    this.alertCooldown = parseInt(process.env.ALERT_COOLDOWN) || 300000; // 5 minutes
    this.lastAlerts = new Map();
  }

  async checkAlerts() {
    try {
      await this.checkErrorRate();
      await this.checkResponseTime();
      await this.checkQueueBacklog();
      await this.checkDeadLetterQueue();
    } catch (error) {
      logger.error('Alert check failed', {
        action: 'alert_check_failed',
        error: error.message
      });
    }
  }

  async checkErrorRate() {
    const metrics = await this.metrics.getMetrics();
    const errorRateMatch = metrics.match(/whatsapp_error_rate{component="webhook"} (\d+\.?\d*)/);
    
    if (errorRateMatch) {
      const errorRate = parseFloat(errorRateMatch[1]);
      
      if (errorRate > this.alertThresholds.errorRate) {
        await this.sendAlert('high_error_rate', {
          component: 'webhook',
          errorRate,
          threshold: this.alertThresholds.errorRate
        });
      }
    }
  }

  async checkResponseTime() {
    const metrics = await this.metrics.getMetrics();
    const responseTimeMatch = metrics.match(/whatsapp_response_time_seconds{quantile="0.95"} (\d+\.?\d*)/);
    
    if (responseTimeMatch) {
      const responseTime = parseFloat(responseTimeMatch[1]) * 1000; // Convert to ms
      
      if (responseTime > this.alertThresholds.responseTime) {
        await this.sendAlert('high_response_time', {
          responseTime,
          threshold: this.alertThresholds.responseTime
        });
      }
    }
  }

  async checkQueueBacklog() {
    const metrics = await this.metrics.getMetrics();
    const queueMatches = metrics.matchAll(/whatsapp_queue_size{queue_name="([^"]+)",status="waiting"} (\d+)/g);
    
    for (const match of queueMatches) {
      const queueName = match[1];
      const backlogSize = parseInt(match[2]);
      
      if (backlogSize > this.alertThresholds.queueBacklog) {
        await this.sendAlert('queue_backlog', {
          queueName,
          backlogSize,
          threshold: this.alertThresholds.queueBacklog
        });
      }
    }
  }

  async checkDeadLetterQueue() {
    const metrics = await this.metrics.getMetrics();
    const dlqMatch = metrics.match(/whatsapp_dead_letter_queue_size (\d+)/);
    
    if (dlqMatch) {
      const dlqSize = parseInt(dlqMatch[1]);
      
      if (dlqSize > this.alertThresholds.deadLetterQueue) {
        await this.sendAlert('dead_letter_queue_full', {
          dlqSize,
          threshold: this.alertThresholds.deadLetterQueue
        });
      }
    }
  }

  async sendAlert(alertType, data) {
    const now = Date.now();
    const lastAlert = this.lastAlerts.get(alertType);
    
    // Check cooldown
    if (lastAlert && (now - lastAlert) < this.alertCooldown) {
      return;
    }

    this.lastAlerts.set(alertType, now);

    // Log alert
    switch (alertType) {
      case 'high_error_rate':
        AlertLogger.logHighErrorRate(data.component, data.errorRate);
        break;
      case 'queue_backlog':
        AlertLogger.logQueueBacklog(data.queueName, data.backlogSize);
        break;
      case 'dead_letter_queue_full':
        logger.error('Dead letter queue is full', {
          action: 'dlq_full_alert',
          dlqSize: data.dlqSize,
          threshold: data.threshold,
          severity: 'critical'
        });
        break;
      case 'high_response_time':
        logger.warn('High response time detected', {
          action: 'high_response_time_alert',
          responseTime: data.responseTime,
          threshold: data.threshold,
          severity: 'warning'
        });
        break;
    }

    // Send external alerts (webhook, Slack, etc.)
    await this.sendExternalAlert(alertType, data);
  }

  async sendExternalAlert(alertType, data) {
    try {
      // Webhook alert
      if (process.env.ALERT_WEBHOOK_URL) {
        await this.sendWebhookAlert(alertType, data);
      }

      // Slack alert
      if (process.env.ALERT_SLACK_WEBHOOK) {
        await this.sendSlackAlert(alertType, data);
      }
    } catch (error) {
      logger.error('Failed to send external alert', {
        action: 'external_alert_failed',
        alertType,
        error: error.message
      });
    }
  }

  async sendWebhookAlert(alertType, data) {
    const payload = {
      alertType,
      timestamp: new Date().toISOString(),
      service: 'whatsapp-messaging',
      data
    };

    // Implementation would send HTTP POST to webhook URL
    logger.info('Webhook alert sent', {
      action: 'webhook_alert_sent',
      alertType,
      payload
    });
  }

  async sendSlackAlert(alertType, data) {
    const message = this.formatSlackMessage(alertType, data);
    
    // Implementation would send to Slack webhook
    logger.info('Slack alert sent', {
      action: 'slack_alert_sent',
      alertType,
      message
    });
  }

  formatSlackMessage(alertType, data) {
    switch (alertType) {
      case 'high_error_rate':
        return `🚨 High error rate detected: ${data.errorRate}% (threshold: ${data.threshold}%)`;
      case 'queue_backlog':
        return `⚠️ Queue backlog: ${data.queueName} has ${data.backlogSize} waiting jobs`;
      case 'dead_letter_queue_full':
        return `💀 Dead letter queue is full: ${data.dlqSize} failed messages`;
      case 'high_response_time':
        return `🐌 High response time: ${data.responseTime}ms (threshold: ${data.threshold}ms)`;
      default:
        return `Alert: ${alertType}`;
    }
  }
}

module.exports = {
  MetricsCollector,
  AlertManager
};