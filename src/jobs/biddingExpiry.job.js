/**
 * Bidding Expiry Job
 * 
 * Runs every 2 minutes to process expired bidding windows
 * and automatically select winners for orders
 */

const schedule = require('node-schedule');
const biddingService = require('../services/bidding.service');
const { logger } = require('../config/logger');

// Run every 2 minutes
const job = schedule.scheduleJob('*/2 * * * *', async function () {
    logger.info('⏰ Running Bidding Expiry Check...');

    try {
        const results = await biddingService.processExpiredOrders();

        logger.info('Bidding expiry check completed', {
            processed: results.processed,
            succeeded: results.succeeded,
            failed: results.failed
        });

        if (results.failed > 0) {
            logger.warn('Some orders failed auto-assignment', {
                errors: results.errors
            });
        }
    } catch (error) {
        logger.error('Bidding expiry job failed', {
            error: error.message,
            stack: error.stack
        });
    }
});

module.exports = job;
