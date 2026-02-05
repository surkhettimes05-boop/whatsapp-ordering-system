const { redisManager } = require('../infrastructure/redis');
const { logger } = require('../infrastructure/logger');
const { MetricsCollector, AlertManager } = require('../monitoring/metrics');

const WebhookWorker = require('./webhook-worker');
const OrderWorker = require('./order-worker');
const ReplyWorker = require('./reply-worker');

class WorkerManager {
  constructor() {
    this.workers = [];
    this.metrics = new MetricsCollector();
    this.alertManager = new AlertManager(this.metrics);
    this.isShuttingDown = false;
    this.healthCheckInterval = null;
    this.alertCheckInterval = null;
  }

  async initialize() {
    logger.info('Initializing worker manager', { action: 'worker_manager_init' });

    // Initialize Redis connections
    await redisManager.initializeConnections();

    // Initialize workers
    await this.initializeWorkers();

    // Start monitoring
    this.startMonitoring();

    logger.info('Worker manager initialized', { 
      action: 'worker_manager_initialized',
      workerCount: this.workers.length
    });
  }

  async initializeWorkers() {
    const workerConfigs = [
      {
        class: WebhookWorker,
        name: 'webhook',
        instances: parseInt(process.env.WEBHOOK_WORKERS) || 2
      },
      {
        class: OrderWorker,
        name: 'order',
        instances: parseInt(process.env.ORDER_WORKERS) || 3
      },
      {
        class: ReplyWorker,
        name: 'reply',
        instances: parseInt(process.env.REPLY_WORKERS) || 4
      }
    ];

    for (const config of workerConfigs) {
      for (let i = 0; i < config.instances; i++) {
        const worker = new config.class();
        await worker.start();
        
        this.workers.push({
          instance: worker,
          type: config.name,
          id: `${config.name}-${i + 1}`,
          startedAt: Date.now()
        });

        logger.info('Worker started', {
          action: 'worker_started',
          workerType: config.name,
          workerId: `${config.name}-${i + 1}`
        });
      }
    }
  }

  startMonitoring() {
    // Health check interval
    const healthCheckInterval = parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000;
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, healthCheckInterval);

    // Alert check interval
    this.alertCheckInterval = setInterval(() => {
      this.alertManager.checkAlerts();
    }, 60000); // Check alerts every minute

    logger.info('Monitoring started', {
      action: 'monitoring_started',
      healthCheckInterval,
      alertCheckInterval: 60000
    });
  }

  async performHealthCheck() {
    try {
      // Check Redis health
      const redisHealth = await redisManager.healthCheck();
      
      // Check worker health
      const workerHealth = this.checkWorkerHealth();
      
      // Update metrics
      await this.updateHealthMetrics(redisHealth, workerHealth);
      
      // Log health status
      logger.info('Health check completed', {
        action: 'health_check_completed',
        redis: Object.keys(redisHealth).reduce((acc, key) => {
          acc[key] = redisHealth[key].status;
          return acc;
        }, {}),
        workers: workerHealth.summary
      });

    } catch (error) {
      logger.error('Health check failed', {
        action: 'health_check_failed',
        error: error.message
      });
    }
  }

  checkWorkerHealth() {
    const health = {
      healthy: 0,
      unhealthy: 0,
      total: this.workers.length,
      workers: []
    };

    for (const worker of this.workers) {
      const isHealthy = !worker.instance.isShuttingDown;
      const workerHealth = {
        id: worker.id,
        type: worker.type,
        status: isHealthy ? 'healthy' : 'unhealthy',
        uptime: Date.now() - worker.startedAt
      };

      health.workers.push(workerHealth);
      
      if (isHealthy) {
        health.healthy++;
      } else {
        health.unhealthy++;
      }
    }

    health.summary = {
      healthy: health.healthy,
      unhealthy: health.unhealthy,
      total: health.total,
      healthyPercentage: Math.round((health.healthy / health.total) * 100)
    };

    return health;
  }

  async updateHealthMetrics(redisHealth, workerHealth) {
    // Update Redis connection metrics
    for (const [connectionName, health] of Object.entries(redisHealth)) {
      const isHealthy = health.status === 'healthy' ? 1 : 0;
      // Update custom metrics here if needed
    }

    // Update worker health metrics
    const workersByType = {};
    for (const worker of workerHealth.workers) {
      if (!workersByType[worker.type]) {
        workersByType[worker.type] = { healthy: 0, total: 0 };
      }
      workersByType[worker.type].total++;
      if (worker.status === 'healthy') {
        workersByType[worker.type].healthy++;
      }
    }

    // Calculate and update error rates
    for (const [workerType, stats] of Object.entries(workersByType)) {
      const errorRate = ((stats.total - stats.healthy) / stats.total) * 100;
      this.metrics.updateErrorRate(workerType, errorRate);
    }
  }

  async getStatus() {
    const redisHealth = await redisManager.healthCheck();
    const workerHealth = this.checkWorkerHealth();
    
    return {
      status: 'running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      redis: redisHealth,
      workers: workerHealth,
      metrics: {
        enabled: process.env.METRICS_ENABLED === 'true',
        port: process.env.METRICS_PORT || 9090
      }
    };
  }

  async restart(workerType = null) {
    logger.info('Restarting workers', {
      action: 'worker_restart',
      workerType: workerType || 'all'
    });

    const workersToRestart = workerType 
      ? this.workers.filter(w => w.type === workerType)
      : this.workers;

    for (const worker of workersToRestart) {
      try {
        logger.info('Restarting worker', {
          action: 'worker_restart_individual',
          workerId: worker.id,
          workerType: worker.type
        });

        // Shutdown old worker
        await worker.instance.shutdown();

        // Create new worker instance
        const WorkerClass = this.getWorkerClass(worker.type);
        const newWorker = new WorkerClass();
        await newWorker.start();

        // Update worker reference
        worker.instance = newWorker;
        worker.startedAt = Date.now();

        logger.info('Worker restarted successfully', {
          action: 'worker_restart_success',
          workerId: worker.id,
          workerType: worker.type
        });

      } catch (error) {
        logger.error('Worker restart failed', {
          action: 'worker_restart_failed',
          workerId: worker.id,
          workerType: worker.type,
          error: error.message
        });
      }
    }
  }

  getWorkerClass(workerType) {
    switch (workerType) {
      case 'webhook': return WebhookWorker;
      case 'order': return OrderWorker;
      case 'reply': return ReplyWorker;
      default: throw new Error(`Unknown worker type: ${workerType}`);
    }
  }

  async shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info('Shutting down worker manager', { action: 'worker_manager_shutdown' });

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
    }

    // Shutdown all workers
    const shutdownPromises = this.workers.map(async (worker) => {
      try {
        await worker.instance.shutdown();
        logger.info('Worker shutdown complete', {
          action: 'worker_shutdown_complete',
          workerId: worker.id,
          workerType: worker.type
        });
      } catch (error) {
        logger.error('Worker shutdown failed', {
          action: 'worker_shutdown_failed',
          workerId: worker.id,
          workerType: worker.type,
          error: error.message
        });
      }
    });

    await Promise.all(shutdownPromises);

    // Shutdown Redis connections
    await redisManager.shutdown();

    logger.info('Worker manager shutdown complete', { 
      action: 'worker_manager_shutdown_complete' 
    });
  }

  // Graceful shutdown handlers
  setupGracefulShutdown() {
    const signals = ['SIGTERM', 'SIGINT'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, starting graceful shutdown`, {
          action: 'graceful_shutdown_start',
          signal
        });
        
        await this.shutdown();
        process.exit(0);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', {
        action: 'uncaught_exception',
        error: error.message,
        stack: error.stack
      });
      
      // Attempt graceful shutdown
      this.shutdown().finally(() => {
        process.exit(1);
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', {
        action: 'unhandled_rejection',
        reason: reason?.message || reason,
        promise: promise.toString()
      });
    });
  }
}

// Start worker manager if run directly
if (require.main === module) {
  const workerManager = new WorkerManager();
  
  workerManager.setupGracefulShutdown();
  
  workerManager.initialize().then(() => {
    logger.info('Worker manager started successfully', {
      action: 'worker_manager_started',
      pid: process.pid
    });
  }).catch(error => {
    logger.error('Failed to start worker manager', {
      action: 'worker_manager_start_failed',
      error: error.message
    });
    process.exit(1);
  });
}

module.exports = WorkerManager;