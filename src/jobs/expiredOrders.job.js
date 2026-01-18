const schedule = require('node-schedule');
const orderDecisionEngine = require('../services/orderDecision.service');

/**
 * Scheduled Job: Process Expired Orders
 * Runs every minute to check for expired orders and assign winners
 */

// Run every minute
const job = schedule.scheduleJob('*/1 * * * *', async () => {
    try {
        console.log('\n⏰ [Expired Orders Job] Running...');
        const result = await orderDecisionEngine.processExpiredOrders();

        if (result.total > 0) {
            console.log(`✅ [Expired Orders Job] Processed ${result.successful}/${result.total} orders`);

            if (result.failed > 0) {
                console.log(`⚠️ [Expired Orders Job] ${result.failed} orders failed:`);
                result.errors.forEach(err => {
                    console.log(`   - Order ${err.orderId.slice(-4)}: ${err.error}`);
                });
            }
        }
    } catch (error) {
        console.error('❌ [Expired Orders Job] Error:', error);
    }
});

console.log('✅ Expired Orders Job scheduled (runs every minute)');

module.exports = job;
