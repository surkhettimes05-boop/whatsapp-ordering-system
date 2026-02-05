const express = require('express');
const { Queue, QueueEvents } = require('bullmq');
const { redisManager } = require('../infrastructure/redis');
const { logger, PerformanceLogger } = require('../infrastructure/logger');
const { MetricsCollector } = require('./metrics');

class QueueMonitor {
  constructor() {
    this.app = express();
    this.queues = new Map();
    this.queueEvents = new Map();
    this.metrics = new MetricsCollector();
    this.monitoringInterval = null;
    this.setupRoutes();
  }

  async initialize() {
    // Initialize Redis connections
    await redisManager.initializeConnections();
    
    // Initialize queue monitoring
    await this.initializeQueueMonitoring();
    
    // Start periodic monitoring
    this.startPeriodicMonitoring();
    
    logger.info('Queue monitor initialized', { action: 'queue_monitor_initialized' });
  }

  async initializeQueueMonitoring() {
    const mainRedis = redisManager.getConnection('main');
    
    const queueNames = [
      process.env.WEBHOOK_QUEUE_NAME || 'whatsapp-webhooks',
      process.env.ORDER_QUEUE_NAME || 'order-processing',
      process.env.VENDOR_QUEUE_NAME || 'vendor-routing',
      process.env.REPLY_QUEUE_NAME || 'whatsapp-replies',
      process.env.DLQ_QUEUE_NAME || 'dead-letter-queue'
    ];

    for (const queueName of queueNames) {
      // Create queue instance for monitoring
      const queue = new Queue(queueName, { connection: mainRedis });
      this.queues.set(queueName, queue);

      // Create queue events listener
      const queueEvents = new QueueEvents(queueName, { connection: mainRedis });
      this.queueEvents.set(queueName, queueEvents);

      // Setup event handlers
      this.setupQueueEventHandlers(queueName, queueEvents);
      
      logger.info(`Queue monitoring setup: ${queueName}`, { 
        action: 'queue_monitoring_setup',
        queueName 
      });
    }
  }

  setupQueueEventHandlers(queueName, queueEvents) {
    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      logger.info('Job completed', {
        action: 'job_completed',
        queueName,
        jobId,
        result: returnvalue?.action
      });
      
      this.metrics.incrementJobsProcessed(queueName.split('-')[0], 'success');
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error('Job failed', {
        action: 'job_failed',
        queueName,
        jobId,
        error: failedReason
      });
      
      this.metrics.incrementJobsFailed(queueName.split('-')[0]);
    });

    queueEvents.on('stalled', ({ jobId }) => {
      logger.warn('Job stalled', {
        action: 'job_stalled',
        queueName,
        jobId
      });
    });

    queueEvents.on('progress', ({ jobId, data }) => {
      logger.debug('Job progress', {
        action: 'job_progress',
        queueName,
        jobId,
        progress: data
      });
    });
  }

  startPeriodicMonitoring() {
    const interval = parseInt(process.env.QUEUE_MONITOR_INTERVAL) || 30000;
    
    this.monitoringInterval = setInterval(async () => {
      await this.collectQueueMetrics();
    }, interval);

    logger.info('Periodic queue monitoring started', {
      action: 'periodic_monitoring_started',
      interval
    });
  }

  async collectQueueMetrics() {
    try {
      for (const [queueName, queue] of this.queues) {
        const counts = await queue.getJobCounts();
        
        // Update metrics
        this.metrics.updateQueueSize(queueName, 'waiting', counts.waiting || 0);
        this.metrics.updateQueueSize(queueName, 'active', counts.active || 0);
        this.metrics.updateQueueSize(queueName, 'completed', counts.completed || 0);
        this.metrics.updateQueueSize(queueName, 'failed', counts.failed || 0);
        this.metrics.updateQueueSize(queueName, 'delayed', counts.delayed || 0);

        // Log metrics
        PerformanceLogger.logQueueMetrics(queueName, counts);

        // Update dead letter queue size
        if (queueName === (process.env.DLQ_QUEUE_NAME || 'dead-letter-queue')) {
          this.metrics.updateDeadLetterQueueSize(counts.waiting + counts.active);
        }
      }
    } catch (error) {
      logger.error('Failed to collect queue metrics', {
        action: 'queue_metrics_failed',
        error: error.message
      });
    }
  }

  setupRoutes() {
    this.app.use(express.json());

    // Health check
    this.app.get('/health', async (req, res) => {
      try {
        const health = await this.getHealthStatus();
        res.json(health);
      } catch (error) {
        res.status(503).json({ 
          status: 'unhealthy', 
          error: error.message 
        });
      }
    });

    // Queue status
    this.app.get('/queues', async (req, res) => {
      try {
        const queueStatus = await this.getQueueStatus();
        res.json(queueStatus);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Specific queue details
    this.app.get('/queues/:queueName', async (req, res) => {
      try {
        const { queueName } = req.params;
        const queue = this.queues.get(queueName);
        
        if (!queue) {
          return res.status(404).json({ error: 'Queue not found' });
        }

        const details = await this.getQueueDetails(queueName, queue);
        res.json(details);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Dead letter queue management
    this.app.get('/dlq', async (req, res) => {
      try {
        const dlqStatus = await this.getDeadLetterQueueStatus();
        res.json(dlqStatus);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Retry failed jobs from DLQ
    this.app.post('/dlq/retry', async (req, res) => {
      try {
        const { jobIds, retryAll } = req.body;
        const result = await this.retryDeadLetterJobs(jobIds, retryAll);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Purge old jobs
    this.app.post('/queues/:queueName/purge', async (req, res) => {
      try {
        const { queueName } = req.params;
        const { status, olderThan } = req.body;
        const result = await this.purgeJobs(queueName, status, olderThan);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      try {
        const metrics = await this.metrics.getMetrics();
        res.set('Content-Type', 'text/plain');
        res.send(metrics);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  async getHealthStatus() {
    const redisHealth = await redisManager.healthCheck();
    const queueHealth = {};

    for (const [queueName, queue] of this.queues) {
      try {
        await queue.getJobCounts();
        queueHealth[queueName] = { status: 'healthy' };
      } catch (error) {
        queueHealth[queueName] = { 
          status: 'unhealthy', 
          error: error.message 
        };
      }
    }

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      redis: redisHealth,
      queues: queueHealth
    };
  }

  async getQueueStatus() {
    const status = {};

    for (const [queueName, queue] of this.queues) {
      try {
        const counts = await queue.getJobCounts();
        const workers = await queue.getWorkers();
        
        status[queueName] = {
          counts,
          workers: workers.length,
          isPaused: await queue.isPaused()
        };
      } catch (error) {
        status[queueName] = { 
          error: error.message 
        };
      }
    }

    return status;
  }

  async getQueueDetails(queueName, queue) {
    const [counts, workers, jobs] = await Promise.all([
      queue.getJobCounts(),
      queue.getWorkers(),
      queue.getJobs(['waiting', 'active', 'completed', 'failed'], 0, 10)
    ]);

    return {
      name: queueName,
      counts,
      workers: workers.length,
      isPaused: await queue.isPaused(),
      recentJobs: jobs.map(job => ({
        id: job.id,
        name: job.name,
        data: job.data,
        opts: job.opts,
        progress: job.progress,
        returnvalue: job.returnvalue,
        failedReason: job.failedReason,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn
      }))
    };
  }

  async getDeadLetterQueueStatus() {
    const dlqName = process.env.DLQ_QUEUE_NAME || 'dead-letter-queue';
    const dlq = this.queues.get(dlqName);
    
    if (!dlq) {
      throw new Error('Dead letter queue not found');
    }

    const counts = await dlq.getJobCounts();
    const failedJobs = await dlq.getJobs(['waiting', 'failed'], 0, 50);

    return {
      counts,
      failedJobs: failedJobs.map(job => ({
        id: job.id,
        originalQueue: job.data.originalQueue,
        originalJobId: job.data.originalJobId,
        messageId: job.data.messageId,
        error: job.data.error,
        failedAt: job.data.failedAt,
        attemptsMade: job.data.attemptsMade
      }))
    };
  }

  async retryDeadLetterJobs(jobIds, retryAll = false) {
    const dlqName = process.env.DLQ_QUEUE_NAME || 'dead-letter-queue';
    const dlq = this.queues.get(dlqName);
    
    if (!dlq) {
      throw new Error('Dead letter queue not found');
    }

    let jobsToRetry = [];
    
    if (retryAll) {
      jobsToRetry = await dlq.getJobs(['waiting', 'failed']);
    } else if (jobIds && jobIds.length > 0) {
      jobsToRetry = await Promise.all(
        jobIds.map(id => dlq.getJob(id))
      );
      jobsToRetry = jobsToRetry.filter(Boolean);
    }

    const results = {
      retried: 0,
      failed: 0,
      errors: []
    };

    for (const job of jobsToRetry) {
      try {
        const originalQueueName = job.data.originalQueue;
        const originalQueue = this.queues.get(originalQueueName);
        
        if (!originalQueue) {
          throw new Error(`Original queue ${originalQueueName} not found`);
        }

        // Re-enqueue the original job
        await originalQueue.add(job.name, job.data.payload, {
          attempts: 3,
          backoff: 'exponential'
        });

        // Remove from DLQ
        await job.remove();
        
        results.retried++;
        
        logger.info('Job retried from DLQ', {
          action: 'dlq_job_retried',
          jobId: job.id,
          originalQueue: originalQueueName,
          messageId: job.data.messageId
        });

      } catch (error) {
        results.failed++;
        results.errors.push({
          jobId: job.id,
          error: error.message
        });
        
        logger.error('Failed to retry job from DLQ', {
          action: 'dlq_retry_failed',
          jobId: job.id,
          error: error.message
        });
      }
    }

    return results;
  }

  async purgeJobs(queueName, status = 'completed', olderThan = 86400000) {
    const queue = this.queues.get(queueName);
    
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const cutoffTime = Date.now() - olderThan;
    const jobs = await queue.getJobs([status], 0, -1);
    
    let purged = 0;
    
    for (const job of jobs) {
      if (job.finishedOn && job.finishedOn < cutoffTime) {
        await job.remove();
        purged++;
      }
    }

    logger.info('Jobs purged', {
      action: 'jobs_purged',
      queueName,
      status,
      purged,
      olderThan
    });

    return { purged };
  }

  async start() {
    await this.initialize();
    
    const port = process.env.QUEUE_MONITOR_PORT || 9091;
    this.server = this.app.listen(port, () => {
      logger.info(`Queue monitor started on port ${port}`, { 
        action: 'queue_monitor_started',
        port 
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  async shutdown() {
    logger.info('Shutting down queue monitor', { action: 'queue_monitor_shutdown' });
    
    // Clear monitoring interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Close server
    if (this.server) {
      this.server.close();
    }

    // Close queue events
    for (const queueEvents of this.queueEvents.values()) {
      await queueEvents.close();
    }

    // Close queues
    for (const queue of this.queues.values()) {
      await queue.close();
    }

    await redisManager.shutdown();
    
    logger.info('Queue monitor shutdown complete', { 
      action: 'queue_monitor_shutdown_complete' 
    });
  }
}

// Start monitor if run directly
if (require.main === module) {
  const monitor = new QueueMonitor();
  monitor.start().catch(error => {
    logger.error('Failed to start queue monitor', { 
      action: 'queue_monitor_start_failed',
      error: error.message 
    });
    process.exit(1);
  });
}

module.exports = QueueMonitor;