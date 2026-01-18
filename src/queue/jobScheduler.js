/**
 * Job Scheduler
 * 
 * Schedules recurring jobs and one-time jobs
 */

const { queues } = require('./queue.config');
const cron = require('node-cron');


/**
 * Schedule recurring jobs
 */
function scheduleRecurringJobs() {
    // Order expiry check - every 2 minutes
    cron.schedule('*/2 * * * *', async () => {
        const prisma = require('../config/database');
        const expiredOrders = await prisma.order.findMany({
            where: {
                expiresAt: {
                    lte: new Date(),
                },
                status: {
                    in: ['PENDING_BIDS', 'WHOLESALER_ACCEPTED', 'CREATED'],
                },
            },
            select: { id: true },
            take: 50,
        });

        for (const order of expiredOrders) {
            await queues.orderExpiry.add('order-expiry', {
                orderId: order.id,
            });
        }
    });

    // Vendor fallback check - every 2 minutes
    cron.schedule('*/2 * * * *', async () => {
        const prisma = require('../config/database');
        const constants = require('../config/constants');
        
        const timeoutMinutes = constants.WHOLESALER_CONFIRMATION_TIMEOUT_MINUTES || 15;
        const timeoutThreshold = new Date(Date.now() - timeoutMinutes * 60 * 1000);

        const timedOutOrders = await prisma.order.findMany({
            where: {
                status: 'WHOLESALER_ACCEPTED',
                updatedAt: {
                    lt: timeoutThreshold,
                },
                confirmedAt: null,
                final_wholesaler_id: { not: null },
            },
            include: {
                vendorOffers: {
                    where: { status: 'ACCEPTED' },
                    select: { wholesalerId: true },
                },
            },
            take: 50,
        });

        for (const order of timedOutOrders) {
            const winningOffer = order.vendorOffers[0];
            if (winningOffer) {
                await queues.vendorFallback.add('vendor-fallback', {
                    orderId: order.id,
                    failedWholesalerId: winningOffer.wholesalerId,
                });
            }
        }
    });

    // Daily reports - every day at 8 AM
    cron.schedule('0 8 * * *', async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        await queues.dailyReports.add('daily-exposure-report', {
            reportType: 'exposure',
            date: yesterday.toISOString(),
        });

        await queues.dailyReports.add('daily-analytics-report', {
            reportType: 'analytics',
            date: yesterday.toISOString(),
        });

        await queues.dailyReports.add('daily-orders-report', {
            reportType: 'orders',
            date: yesterday.toISOString(),
        });
    });

    // Credit reconciliation - every day at 2 AM
    cron.schedule('0 2 * * *', async () => {
        await queues.creditReconciliation.add('credit-reconciliation-all', {
            reconcileAll: true,
        });
    });

    console.log('✅ Recurring jobs scheduled');
}

/**
 * Add one-time job
 */
async function addJob(queueName, jobName, data, options = {}) {
    const queue = queues[queueName];
    if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
    }

    return await queue.add(jobName, data, options);
}

module.exports = {
    scheduleRecurringJobs,
    addJob,
};
