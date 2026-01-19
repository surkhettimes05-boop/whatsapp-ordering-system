/**
 * Recovery Job
 * 
 * Runs recovery worker every 15 minutes to detect and repair:
 * - Incomplete orders
 * - Failed vendor selections
 * - Stuck ledger entries
 * - Orphaned stock reservations
 */

const schedule = require('node-schedule');
const recoveryWorker = require('../workers/recovery.worker');
const { logger } = require('../config/logger');

// Run every 15 minutes
const job = schedule.scheduleJob('*/15 * * * *', async function () {
    logger.info('⏰ Running Recovery Worker...');

    try {
        const report = await recoveryWorker.run();

        if (report.summary.totalFailed > 0) {
            logger.warn('Recovery worker completed with failures', {
                repaired: report.summary.totalRepaired,
                failed: report.summary.totalFailed
            });
        }
    } catch (error) {
        logger.error('Recovery job failed', {
            error: error.message,
            stack: error.stack
        });
    }
});

module.exports = job;
