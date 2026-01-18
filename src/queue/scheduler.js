/**
 * BullMQ Scheduler
 * 
 * Schedules recurring jobs (cron-like)
 */

const { addScheduledJob, JOB_TYPES } = require('./queue');

/**
 * Initialize scheduled jobs
 */
function initializeScheduledJobs() {
    // Daily reports - Run at midnight every day
    addScheduledJob(
        JOB_TYPES.DAILY_REPORTS,
        { reportType: 'all' },
        '0 0 * * *' // Every day at midnight
    );

    // Credit reconciliation - Run daily at 2 AM
    addScheduledJob(
        JOB_TYPES.CREDIT_RECONCILIATION,
        {},
        '0 2 * * *' // Every day at 2 AM
    );

    // Payment reminders - Run daily at 9 AM
    addScheduledJob(
        JOB_TYPES.PAYMENT_REMINDERS,
        {},
        '0 9 * * *' // Every day at 9 AM
    );

    // Bidding timeout check - Run every 2 minutes
    // Note: This is better handled by delayed jobs, but keeping for compatibility
    addScheduledJob(
        JOB_TYPES.BIDDING_TIMEOUT,
        {},
        '*/2 * * * *' // Every 2 minutes
    );

    // Wholesaler confirmation timeout check - Run every 2 minutes
    addScheduledJob(
        JOB_TYPES.WHOLESALER_CONFIRMATION_TIMEOUT,
        {},
        '*/2 * * * *' // Every 2 minutes
    );

    console.log('✅ Scheduled jobs initialized');
}

module.exports = {
    initializeScheduledJobs
};
