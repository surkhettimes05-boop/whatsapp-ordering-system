/**
 * Daily Reconciliation Job
 * 
 * Fintech Auditor: Automated daily financial reconciliation
 * 
 * Runs daily to:
 * - Verify ledger integrity
 * - Compare with outstanding orders
 * - Identify discrepancies
 * - Generate audit reports
 * - Send alerts on mismatches
 */

const reconciliationService = require('../services/reconciliation.service');
const logger = require('../utils/logger');

/**
 * Run daily reconciliation
 * 
 * @param {Object} options - Execution options
 * @param {Date} options.date - Date to reconcile (default: today)
 * @param {boolean} options.save_report - Store report in database (default: true)
 * @param {boolean} options.send_alerts - Send alerts on mismatches (default: true)
 * @returns {Promise<Object>} Reconciliation report
 */
async function runDailyReconciliation(options = {}) {
  const {
    date = new Date(),
    save_report = true,
    send_alerts = true
  } = options;

  const jobStartTime = Date.now();

  try {
    logger.info('Daily reconciliation job started', {
      date: date.toISOString(),
      timestamp: new Date().toISOString()
    });

    // 1. Perform reconciliation
    const report = await reconciliationService.performDailyReconciliation({
      date,
      detailed: true
    });

    // 2. Save report if requested
    if (save_report) {
      await reconciliationService.storeReconciliationReport(report);
      logger.info('Reconciliation report stored');
    }

    // 3. Send alerts if there are mismatches
    if (send_alerts && report.mismatches.length > 0) {
      await sendReconciliationAlerts(report);
    }

    // 4. Log summary
    const duration = Date.now() - jobStartTime;
    logger.info('Daily reconciliation job completed', {
      status: report.status,
      mismatches: report.mismatch_count,
      duration_ms: duration,
      variance: report.statistics.variance
    });

    return report;
  } catch (error) {
    logger.error('Daily reconciliation job failed', {
      error: error.message,
      stack: error.stack,
      duration_ms: Date.now() - jobStartTime
    });
    throw error;
  }
}

/**
 * Send reconciliation alerts
 * 
 * @param {Object} report - Reconciliation report
 * @returns {Promise<void>}
 */
async function sendReconciliationAlerts(report) {
  try {
    // Email alert (if configured)
    if (process.env.ALERT_EMAIL) {
      logger.warn('RECONCILIATION ALERT', {
        status: report.status,
        mismatches: report.mismatch_count,
        variance: report.statistics.variance,
        alert_to: process.env.ALERT_EMAIL
      });

      // TODO: Send email notification
      // await emailService.send({
      //   to: process.env.ALERT_EMAIL,
      //   subject: 'Financial Reconciliation Alert',
      //   template: 'reconciliation-alert',
      //   data: report
      // });
    }

    // Slack alert (if configured)
    if (process.env.SLACK_WEBHOOK_URL) {
      logger.warn('Posting to Slack', {
        webhook: process.env.SLACK_WEBHOOK_URL.substring(0, 20) + '...',
        mismatches: report.mismatch_count
      });

      // TODO: Send Slack notification
      // await slackService.postMessage({...});
    }

    // Log to audit system
    logger.error('AUDIT: Reconciliation mismatches detected', {
      count: report.mismatch_count,
      types: report.mismatches.map(m => m.type),
      severity: Math.max(...report.mismatches.map(m => m.severity === 'HIGH' ? 3 : m.severity === 'MEDIUM' ? 2 : 1))
    });
  } catch (error) {
    logger.error('Error sending reconciliation alerts', {
      error: error.message
    });
  }
}

/**
 * Create scheduler for daily reconciliation
 * 
 * Default: 02:00 AM (UTC) daily
 * 
 * @param {string} schedule - Cron schedule (default '0 2 * * *')
 * @returns {Object} Task object with control methods
 */
function createDailyReconciliationScheduler(schedule = '0 2 * * *') {
  try {
    const cron = require('node-cron');

    logger.info('Creating daily reconciliation scheduler', {
      schedule,
      description: 'Runs daily at 2:00 AM UTC'
    });

    const task = cron.schedule(schedule, async () => {
      logger.info('Daily reconciliation scheduled task triggered');
      try {
        await runDailyReconciliation({
          save_report: true,
          send_alerts: true
        });
      } catch (error) {
        logger.error('Scheduled reconciliation failed', {
          error: error.message
        });
      }
    });

    return {
      task,
      start: () => {
        task.start();
        logger.info('Daily reconciliation scheduler started');
      },
      stop: () => {
        task.stop();
        logger.info('Daily reconciliation scheduler stopped');
      },
      destroy: () => {
        task.destroy();
        logger.info('Daily reconciliation scheduler destroyed');
      }
    };
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      logger.warn('node-cron not installed, reconciliation scheduler unavailable');
      return null;
    }
    throw error;
  }
}

/**
 * Initialize reconciliation system
 * 
 * @param {Object} options - Initialization options
 * @param {string} options.schedule - Cron schedule
 * @param {boolean} options.run_on_start - Run now on startup
 * @returns {Promise<Object>} Initialization result
 */
async function initializeReconciliation(options = {}) {
  const {
    schedule = '0 2 * * *', // 2 AM UTC daily
    run_on_start = false
  } = options;

  try {
    logger.info('Initializing reconciliation system');

    // Run immediately if requested
    if (run_on_start) {
      logger.info('Running initial reconciliation');
      await runDailyReconciliation({
        save_report: true,
        send_alerts: true
      });
    }

    // Create scheduler
    const scheduler = createDailyReconciliationScheduler(schedule);

    if (scheduler) {
      scheduler.start();

      return {
        success: true,
        scheduler,
        message: 'Reconciliation system initialized with scheduler'
      };
    } else {
      logger.warn('Reconciliation system initialized without scheduler (node-cron not available)');
      return {
        success: true,
        scheduler: null,
        message: 'Reconciliation system initialized (scheduler unavailable)'
      };
    }
  } catch (error) {
    logger.error('Error initializing reconciliation', {
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
 * Graceful shutdown of reconciliation
 * 
 * @param {Object} scheduler - Scheduler from initialization
 */
function shutdownReconciliation(scheduler) {
  if (scheduler) {
    try {
      scheduler.stop();
      scheduler.destroy();
      logger.info('Reconciliation scheduler shutdown gracefully');
    } catch (error) {
      logger.error('Error shutting down reconciliation', {
        error: error.message
      });
    }
  }
}

/**
 * Get reconciliation status
 * 
 * @returns {Promise<Object>} Current status
 */
async function getReconciliationStatus() {
  try {
    const stats = await reconciliationService.getReconciliationStatistics();
    
    return {
      status: 'OK',
      statistics: stats,
      last_check: new Date()
    };
  } catch (error) {
    logger.error('Error getting reconciliation status', {
      error: error.message
    });

    return {
      status: 'ERROR',
      error: error.message,
      last_check: new Date()
    };
  }
}

module.exports = {
  runDailyReconciliation,
  createDailyReconciliationScheduler,
  initializeReconciliation,
  shutdownReconciliation,
  getReconciliationStatus,
  sendReconciliationAlerts
};
