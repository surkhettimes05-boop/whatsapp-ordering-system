/**
 * BullMQ Queue Configuration
 * 
 * Distributed job queue system with Redis
 * Supports multiple job types with retry policies and dead-letter queues
 */

let Queue, QueueEvents, IORedis;
let connection;

// Try to load BullMQ and ioredis; provide safe in-memory stubs for tests
try {
    ({ Queue, QueueEvents } = require('bullmq'));
    IORedis = require('ioredis');

    // Redis connection configuration
    // Redis connection configuration
    const redisOptions = {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: (times) => Math.min(times * 50, 2000)
    };

    if (process.env.REDIS_URL) {
        connection = new IORedis(process.env.REDIS_URL, redisOptions);
    } else {
        connection = new IORedis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            ...redisOptions
        });
    }

    // Prevent unhandled error events from crashing the process
    connection.on('error', (err) => {
        // Only log network errors, don't crash
        console.error('❌ Redis Connection Error:', err.message);
    });

    connection.on('connect', () => {
        console.log('✅ Connected to Redis');
    });
} catch (e) {
    // Provide in-memory stub implementations when BullMQ/ioredis are unavailable
    console.warn('⚠️  BullMQ / ioredis not available — using in-memory queue stubs');

    class InMemoryQueue {
        constructor(name) { this.name = name; this.jobs = []; }
        async add(name, data, opts) { const job = { id: `${name}-${Date.now()}`, data, opts }; this.jobs.push(job); return job; }
        async getWaitingCount() { return this.jobs.length; }
        async getActiveCount() { return 0; }
        async getCompletedCount() { return 0; }
        async getFailedCount() { return 0; }
        async getDelayedCount() { return 0; }
        async getFailed() { return []; }
        async getJobs() { return this.jobs; }
        async getJob(id) { return this.jobs.find(j => j.id === id) || null; }
    }

    class InMemoryQueueEvents {
        constructor() { }
        on() { }
    }

    Queue = InMemoryQueue;
    QueueEvents = InMemoryQueueEvents;
    connection = {
        ping: async () => 'PONG'
    };
}

// Job type definitions
const JOB_TYPES = {
    WHATSAPP_MESSAGE_SEND: 'whatsapp-message-send',
    ORDER_EXPIRY: 'order-expiry',
    VENDOR_FALLBACK: 'vendor-fallback',
    DAILY_REPORTS: 'daily-reports',
    CREDIT_RECONCILIATION: 'credit-reconciliation',
    BIDDING_TIMEOUT: 'bidding-timeout',
    WHOLESALER_CONFIRMATION_TIMEOUT: 'wholesaler-confirmation-timeout',
    PAYMENT_REMINDERS: 'payment-reminders'
};

// Retry policy configuration
const RETRY_POLICIES = {
    // WhatsApp messages - 3 retries with exponential backoff
    [JOB_TYPES.WHATSAPP_MESSAGE_SEND]: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000 // Start with 2 seconds
        },
        removeOnComplete: {
            age: 24 * 3600, // Keep completed jobs for 24 hours
            count: 1000 // Keep last 1000 completed jobs
        },
        removeOnFail: {
            age: 7 * 24 * 3600 // Keep failed jobs for 7 days
        }
    },
    // Order expiry - 1 retry, immediate
    [JOB_TYPES.ORDER_EXPIRY]: {
        attempts: 1,
        backoff: {
            type: 'fixed',
            delay: 1000
        },
        removeOnComplete: {
            age: 24 * 3600,
            count: 500
        },
        removeOnFail: {
            age: 7 * 24 * 3600
        }
    },
    // Vendor fallback - 2 retries
    [JOB_TYPES.VENDOR_FALLBACK]: {
        attempts: 2,
        backoff: {
            type: 'exponential',
            delay: 5000
        },
        removeOnComplete: {
            age: 24 * 3600,
            count: 500
        },
        removeOnFail: {
            age: 7 * 24 * 3600
        }
    },
    // Daily reports - 1 retry
    [JOB_TYPES.DAILY_REPORTS]: {
        attempts: 1,
        backoff: {
            type: 'fixed',
            delay: 60000 // 1 minute
        },
        removeOnComplete: {
            age: 30 * 24 * 3600, // Keep for 30 days
            count: 100
        },
        removeOnFail: {
            age: 7 * 24 * 3600
        }
    },
    // Credit reconciliation - 2 retries
    [JOB_TYPES.CREDIT_RECONCILIATION]: {
        attempts: 2,
        backoff: {
            type: 'exponential',
            delay: 10000
        },
        removeOnComplete: {
            age: 30 * 24 * 3600,
            count: 200
        },
        removeOnFail: {
            age: 7 * 24 * 3600
        }
    },
    // Bidding timeout - 1 retry
    [JOB_TYPES.BIDDING_TIMEOUT]: {
        attempts: 1,
        backoff: {
            type: 'fixed',
            delay: 2000
        },
        removeOnComplete: {
            age: 24 * 3600,
            count: 500
        },
        removeOnFail: {
            age: 7 * 24 * 3600
        }
    },
    // Wholesaler confirmation timeout - 1 retry
    [JOB_TYPES.WHOLESALER_CONFIRMATION_TIMEOUT]: {
        attempts: 1,
        backoff: {
            type: 'fixed',
            delay: 2000
        },
        removeOnComplete: {
            age: 24 * 3600,
            count: 500
        },
        removeOnFail: {
            age: 7 * 24 * 3600
        }
    },
    // Payment reminders - 2 retries
    [JOB_TYPES.PAYMENT_REMINDERS]: {
        attempts: 2,
        backoff: {
            type: 'exponential',
            delay: 3000
        },
        removeOnComplete: {
            age: 24 * 3600,
            count: 1000
        },
        removeOnFail: {
            age: 7 * 24 * 3600
        }
    }
};

/**
 * Create a queue with retry policy and dead-letter queue
 * @param {string} queueName - Queue name
 * @returns {Queue} - BullMQ queue instance
 */
function createQueue(queueName) {
    const retryPolicy = RETRY_POLICIES[queueName] || {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000
        }
    };

    const queue = new Queue(queueName, {
        connection,
        defaultJobOptions: {
            ...retryPolicy,
            // Dead-letter queue configuration
            removeOnComplete: retryPolicy.removeOnComplete || {
                age: 24 * 3600,
                count: 1000
            },
            removeOnFail: retryPolicy.removeOnFail || {
                age: 7 * 24 * 3600
            }
        }
    });

    // Set up queue events for monitoring
    const queueEvents = new QueueEvents(queueName, { connection });

    // Log job events
    queueEvents.on('completed', ({ jobId }) => {
        console.log(`✅ Job ${jobId} completed in queue ${queueName}`);
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
        console.error(`❌ Job ${jobId} failed in queue ${queueName}: ${failedReason}`);
    });

    queueEvents.on('stalled', ({ jobId }) => {
        console.warn(`⚠️ Job ${jobId} stalled in queue ${queueName}`);
    });

    return queue;
}

/**
 * Get or create queue instance
 */
const queues = {};

function getQueue(queueName) {
    if (!queues[queueName]) {
        queues[queueName] = createQueue(queueName);
    }
    return queues[queueName];
}

/**
 * Initialize all queues
 */
function initializeQueues() {
    Object.values(JOB_TYPES).forEach(jobType => {
        getQueue(jobType);
    });
    console.log('✅ All BullMQ queues initialized');
}

/**
 * Add job to queue
 * @param {string} queueName - Queue name
 * @param {object} jobData - Job data
 * @param {object} options - Job options (delay, priority, etc.)
 * @returns {Promise<Job>} - Created job
 */
async function addJob(queueName, jobData, options = {}) {
    const queue = getQueue(queueName);
    return await queue.add(queueName, jobData, {
        ...options,
        jobId: options.jobId || `${queueName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
}

/**
 * Add delayed job
 * @param {string} queueName - Queue name
 * @param {object} jobData - Job data
 * @param {number} delayMs - Delay in milliseconds
 * @returns {Promise<Job>} - Created job
 */
async function addDelayedJob(queueName, jobData, delayMs) {
    return await addJob(queueName, jobData, {
        delay: delayMs
    });
}

/**
 * Add scheduled job (cron-like)
 * @param {string} queueName - Queue name
 * @param {object} jobData - Job data
 * @param {string} cronPattern - Cron pattern (e.g., "0 0 * * *" for daily at midnight)
 * @returns {Promise<Job>} - Created job
 */
async function addScheduledJob(queueName, jobData, cronPattern) {
    const queue = getQueue(queueName);
    return await queue.add(queueName, jobData, {
        repeat: {
            pattern: cronPattern
        }
    });
}

/**
 * Get queue metrics
 * @param {string} queueName - Queue name
 * @returns {Promise<object>} - Queue metrics
 */
async function getQueueMetrics(queueName) {
    const queue = getQueue(queueName);

    const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount()
    ]);

    return {
        queueName,
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed
    };
}

/**
 * Get all queue metrics
 * @returns {Promise<Array>} - All queue metrics
 */
async function getAllQueueMetrics() {
    const metrics = await Promise.all(
        Object.values(JOB_TYPES).map(queueName => getQueueMetrics(queueName))
    );
    return metrics;
}

/**
 * Clean up failed jobs (move to dead-letter queue)
 * @param {string} queueName - Queue name
 * @param {number} limit - Number of jobs to clean
 * @returns {Promise<number>} - Number of jobs cleaned
 */
async function cleanFailedJobs(queueName, limit = 100) {
    const queue = getQueue(queueName);
    const failed = await queue.getFailed(0, limit);

    // Move to dead-letter queue
    const deadLetterQueue = getQueue(`${queueName}-dlq`);

    for (const job of failed) {
        await deadLetterQueue.add(`${queueName}-dlq`, {
            originalJobId: job.id,
            originalQueue: queueName,
            failedReason: job.failedReason,
            data: job.data,
            timestamp: new Date().toISOString()
        });
        await job.remove();
    }

    return failed.length;
}

/**
 * Get dead-letter queue jobs
 * @param {string} queueName - Queue name
 * @returns {Promise<Array>} - Dead-letter jobs
 */
async function getDeadLetterJobs(queueName) {
    const deadLetterQueue = getQueue(`${queueName}-dlq`);
    const jobs = await deadLetterQueue.getJobs(['completed', 'failed', 'waiting'], 0, 100);
    return jobs.map(job => ({
        id: job.id,
        data: job.data,
        failedReason: job.failedReason,
        timestamp: job.timestamp
    }));
}

/**
 * Retry failed job
 * @param {string} queueName - Queue name
 * @param {string} jobId - Job ID
 * @returns {Promise<Job>} - Retried job
 */
async function retryJob(queueName, jobId) {
    const queue = getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
        throw new Error(`Job ${jobId} not found in queue ${queueName}`);
    }

    return await job.retry();
}

module.exports = {
    connection,
    JOB_TYPES,
    RETRY_POLICIES,
    getQueue,
    initializeQueues,
    addJob,
    addDelayedJob,
    addScheduledJob,
    getQueueMetrics,
    getAllQueueMetrics,
    cleanFailedJobs,
    getDeadLetterJobs,
    retryJob
};
