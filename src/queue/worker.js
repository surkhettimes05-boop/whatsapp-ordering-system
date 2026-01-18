/**
 * BullMQ Worker Configuration
 * 
 * Distributed job workers with retry policies and error handling
 */

const { Worker } = require('bullmq');
const { connection, JOB_TYPES } = require('./queue');

// Import job processors
const whatsappMessageProcessor = require('./processors/whatsappMessage.processor');
const orderExpiryProcessor = require('./processors/orderExpiry.processor');
const vendorFallbackProcessor = require('./processors/vendorFallback.processor');
const dailyReportsProcessor = require('./processors/dailyReports.processor');
const creditReconciliationProcessor = require('./processors/creditReconciliation.processor');
const biddingTimeoutProcessor = require('./processors/biddingTimeout.processor');
const wholesalerConfirmationTimeoutProcessor = require('./processors/wholesalerConfirmationTimeout.processor');
const paymentRemindersProcessor = require('./processors/paymentReminders.processor');

// Worker configuration
const WORKER_CONFIG = {
    concurrency: 5, // Process 5 jobs concurrently
    limiter: {
        max: 10, // Max 10 jobs per duration
        duration: 1000 // Per second
    },
    removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 1000 // Keep last 1000 completed jobs
    },
    removeOnFail: {
        age: 7 * 24 * 3600 // Keep failed jobs for 7 days
    }
};

// Job processor mapping
const PROCESSORS = {
    [JOB_TYPES.WHATSAPP_MESSAGE_SEND]: whatsappMessageProcessor,
    [JOB_TYPES.ORDER_EXPIRY]: orderExpiryProcessor,
    [JOB_TYPES.VENDOR_FALLBACK]: vendorFallbackProcessor,
    [JOB_TYPES.DAILY_REPORTS]: dailyReportsProcessor,
    [JOB_TYPES.CREDIT_RECONCILIATION]: creditReconciliationProcessor,
    [JOB_TYPES.BIDDING_TIMEOUT]: biddingTimeoutProcessor,
    [JOB_TYPES.WHOLESALER_CONFIRMATION_TIMEOUT]: wholesalerConfirmationTimeoutProcessor,
    [JOB_TYPES.PAYMENT_REMINDERS]: paymentRemindersProcessor
};

// Workers registry
const workers = {};

/**
 * Create worker for a queue
 * @param {string} queueName - Queue name
 * @returns {Worker} - BullMQ worker instance
 */
function createWorker(queueName) {
    const processor = PROCESSORS[queueName];
    
    if (!processor) {
        throw new Error(`No processor found for queue ${queueName}`);
    }

    const worker = new Worker(
        queueName,
        async (job) => {
            console.log(`🔄 Processing job ${job.id} in queue ${queueName}`);
            
            try {
                const result = await processor(job);
                console.log(`✅ Job ${job.id} completed successfully`);
                return result;
            } catch (error) {
                console.error(`❌ Job ${job.id} failed:`, error);
                throw error; // Re-throw to trigger retry mechanism
            }
        },
        {
            connection,
            ...WORKER_CONFIG,
            // Custom error handling
            settings: {
                stalledInterval: 30000, // Check for stalled jobs every 30 seconds
                maxStalledCount: 1 // Max times a job can be stalled before failing
            }
        }
    );

    // Worker event handlers
    worker.on('completed', (job) => {
        console.log(`✅ Worker completed job ${job.id} in queue ${queueName}`);
    });

    worker.on('failed', (job, err) => {
        console.error(`❌ Worker failed job ${job?.id} in queue ${queueName}:`, err.message);
        
        // Log to database or monitoring service
        logJobFailure(queueName, job, err);
    });

    worker.on('stalled', (jobId) => {
        console.warn(`⚠️ Worker detected stalled job ${jobId} in queue ${queueName}`);
    });

    worker.on('error', (err) => {
        console.error(`❌ Worker error in queue ${queueName}:`, err);
    });

    return worker;
}

/**
 * Log job failure to database
 * @param {string} queueName - Queue name
 * @param {Job} job - Failed job
 * @param {Error} error - Error object
 */
async function logJobFailure(queueName, job, error) {
    try {
        const prisma = require('../config/database');
        
        // Find system admin for logging
        const systemAdmin = await prisma.admin.findFirst({
            where: {
                email: 'system@platform.com'
            },
            select: { id: true }
        });

        const adminId = systemAdmin?.id || (await prisma.admin.findFirst({ select: { id: true } }))?.id;

        if (adminId && job) {
            await prisma.adminAuditLog.create({
                data: {
                    adminId,
                    action: `JOB_FAILED_${queueName.toUpperCase()}`,
                    targetId: job.id || 'unknown',
                    reason: `Job failed: ${error.message}`,
                    metadata: JSON.stringify({
                        queueName,
                        jobId: job.id,
                        jobData: job.data,
                        error: {
                            message: error.message,
                            stack: error.stack
                        },
                        timestamp: new Date().toISOString()
                    })
                }
            });
        }
    } catch (logError) {
        console.error('Failed to log job failure:', logError);
    }
}

/**
 * Initialize all workers
 */
function initializeWorkers() {
    Object.values(JOB_TYPES).forEach(queueName => {
        try {
            workers[queueName] = createWorker(queueName);
            console.log(`✅ Worker initialized for queue: ${queueName}`);
        } catch (error) {
            console.error(`❌ Failed to initialize worker for ${queueName}:`, error);
        }
    });
    
    console.log(`✅ All workers initialized (${Object.keys(workers).length} workers)`);
}

/**
 * Gracefully shutdown all workers
 */
async function shutdownWorkers() {
    console.log('🛑 Shutting down workers...');
    
    const shutdownPromises = Object.entries(workers).map(async ([queueName, worker]) => {
        try {
            await worker.close();
            console.log(`✅ Worker ${queueName} closed`);
        } catch (error) {
            console.error(`❌ Error closing worker ${queueName}:`, error);
        }
    });

    await Promise.all(shutdownPromises);
    console.log('✅ All workers shut down');
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    await shutdownWorkers();
    process.exit(0);
});

process.on('SIGINT', async () => {
    await shutdownWorkers();
    process.exit(0);
});

module.exports = {
    createWorker,
    initializeWorkers,
    shutdownWorkers,
    workers
};
