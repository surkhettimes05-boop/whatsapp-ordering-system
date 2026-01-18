const schedule = require('node-schedule');
const orderRecoveryService = require('../services/orderRecovery.service');

/**
 * FEATURE 5: Order Failure & Recovery Flow
 * 
 * Job 1: Expire pending orders older than 24 hours
 * Run every 6 hours
 */
const expirePendingOrdersJob = schedule.scheduleJob('0 */6 * * *', async function () {
    console.log('⏰ Running Expire Pending Orders Job...');

    try {
        const result = await orderRecoveryService.expirePendingOrders();
        console.log(`✅ Expiry job completed - ${result.count} orders expired`);
    } catch (e) {
        console.error('❌ Error in Expire Pending Orders Job:', e);
    }
});

/**
 * Job 2: Send follow-up messages for expired pending orders
 * Run daily at 2:00 PM
 * This is polite and non-intrusive
 */
const sendFollowUpJob = schedule.scheduleJob('0 14 * * *', async function () {
    console.log('⏰ Running Follow-up Messages Job...');

    try {
        const result = await orderRecoveryService.sendFollowUpMessages();
        console.log(`✅ Follow-up job completed - ${result.sent} messages sent`);
    } catch (e) {
        console.error('❌ Error in Follow-up Messages Job:', e);
    }
});

module.exports = {
    expirePendingOrdersJob,
    sendFollowUpJob
};
