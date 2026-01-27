/**
 * Idempotency Cleanup Job
 * 
 * Background job to remove expired idempotency entries
 * Runs periodically (default every hour)
 * 
 * Purpose:
 * - Prevent unbounded database growth
 * - Keep webhook_idempotency table size manageable
 * - Clean up entries older than TTL
 * 
 * Execution:
 * - Called by job scheduler (e.g., node-cron, agenda, bull)
 * - Safe to run multiple times (idempotent)
 * - Logs statistics for monitoring
 */

const idempotencyService = require('../services/idempotency.service');
const logger = require('../utils/logger');

/**
 * Run idempotency cleanup job
 * 
 * @param {Object} options - Job options
 * @param {number} options.max_age_seconds - Delete entries older than this (default 86400 = 24h)
 * @param {boolean} options.log_stats - Log statistics after cleanup (default true)
 * @returns {Promise<Object>} Job result with statistics
 */
async function runIdempotencyCleanup(options = {}) {
  const {
    max_age_seconds = 86400, // 24 hours
    log_stats = true
  } = options;

  const jobStartTime = Date.now();

  try {
    logger.info('Starting idempotency cleanup job', {
      max_age_seconds,
      timestamp: new Date().toISOString()
    });

    // Run cleanup
    const deletedCount = await idempotencyService.cleanupExpiredEntries();

    const jobDuration = Date.now() - jobStartTime;

    logger.info('Idempotency cleanup job completed', {
      deleted_count: deletedCount,
      duration_ms: jobDuration,
      timestamp: new Date().toISOString()
    });

    // Get statistics if requested
    let stats = null;
    if (log_stats) {
      stats = await idempotencyService.getStatistics();
      
      logger.info('Idempotency storage statistics', {
        total_keys: stats.total_keys,
        active_keys: stats.active_keys,
        expired_keys: stats.expired_keys,
        by_webhook_type: stats.by_webhook_type
      });
    }

    return {
      success: true,
      deleted_count: deletedCount,
      duration_ms: jobDuration,
      statistics: stats
    };
  } catch (error) {
    logger.error('Idempotency cleanup job failed', {
      error: error.message,
      stack: error.stack,
      duration_ms: Date.now() - jobStartTime
    });

    return {
      success: false,
      error: error.message,
      duration_ms: Date.now() - jobStartTime
    };
  }
}

/**
 * Create a scheduler for recurring idempotency cleanup
 * 
 * Uses node-cron to schedule job
 * 
 * Schedule patterns (cron format):
 * - '0 * * * *' = Every hour at minute 0
 * - '0 0 * * *' = Every day at midnight
 * - '*/30 * * * *' = Every 30 minutes
 * - '0 2 * * *' = Every day at 2 AM
 * 
 * @param {string} schedule - Cron schedule pattern (default hourly)
 * @returns {Object} Task object with start/stop methods
 */
function createIdempotencyCleanupScheduler(schedule = '0 * * * *') {
  try {
    const cron = require('node-cron');
    
    logger.info('Starting idempotency cleanup scheduler', {
      schedule
    });

    const task = cron.schedule(schedule, async () => {
      logger.debug('Idempotency cleanup job triggered by scheduler');
      await runIdempotencyCleanup({
        log_stats: true
      });
    });

    return {
      task,
      start: () => {
        task.start();
        logger.info('Idempotency cleanup scheduler started');
      },
      stop: () => {
        task.stop();
        logger.info('Idempotency cleanup scheduler stopped');
      },
      destroy: () => {
        task.destroy();
        logger.info('Idempotency cleanup scheduler destroyed');
      }
    };
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      logger.warn('node-cron not installed, idempotency cleanup scheduler not available');
      return null;
    }
    throw error;
  }
}

/**
 * Initialize idempotency cleanup
 * Call this once during application startup
 * 
 * @param {Object} options - Initialization options
 * @param {string} options.schedule - Cron schedule (default hourly)
 * @param {boolean} options.run_on_start - Run cleanup immediately on start (default true)
 * @returns {Promise<Object>} Initialization result
 */
async function initializeIdempotencyCleanup(options = {}) {
  const {
    schedule = '0 * * * *', // Every hour
    run_on_start = true
  } = options;

  try {
    logger.info('Initializing idempotency cleanup system');

    // Run cleanup immediately if requested
    if (run_on_start) {
      logger.info('Running initial idempotency cleanup');
      await runIdempotencyCleanup({ log_stats: true });
    }

    // Create scheduler
    const scheduler = createIdempotencyCleanupScheduler(schedule);

    if (scheduler) {
      scheduler.start();
      
      return {
        success: true,
        scheduler,
        message: 'Idempotency cleanup system initialized and scheduler started'
      };
    } else {
      logger.warn('Idempotency cleanup scheduler not available (node-cron not installed)');
      
      return {
        success: true,
        scheduler: null,
        message: 'Idempotency cleanup initialized but scheduler not available (node-cron not installed)'
      };
    }
  } catch (error) {
    logger.error('Error initializing idempotency cleanup', {
      error: error.message
    });

    return {
      success: false,
      error: error.message,
      scheduler: null
    };
  }
}

/**
 * Gracefully shutdown idempotency cleanup
 * Call this during application shutdown
 * 
 * @param {Object} scheduler - Scheduler object from initializeIdempotencyCleanup
 */
function shutdownIdempotencyCleanup(scheduler) {
  if (scheduler) {
    try {
      scheduler.stop();
      scheduler.destroy();
      logger.info('Idempotency cleanup scheduler shutdown gracefully');
    } catch (error) {
      logger.error('Error shutting down idempotency cleanup', {
        error: error.message
      });
    }
  }
}

module.exports = {
  runIdempotencyCleanup,
  createIdempotencyCleanupScheduler,
  initializeIdempotencyCleanup,
  shutdownIdempotencyCleanup
};
