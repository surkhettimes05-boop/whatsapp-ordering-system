/**
 * BullMQ Queue Configuration
 * 
 * Centralized configuration for all job queues
 */

const { Queue, QueueEvents } = require('bullmq');
const Redis = require('ioredis');

// Redis connection configuration
const redisConnection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
};

// Create Redis connection
const connection = new Redis(redisConnection);

// Queue configurations
const queueConfigs = {
    whatsapp: {
        name: 'whatsapp-messages',
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000, // 2s, 4s, 8s
            },
            removeOnComplete: {
                age: 24 * 3600, // Keep completed jobs for 24 hours
                count: 1000, // Keep last 1000 completed jobs
            },
            removeOnFail: {
                age: 7 * 24 * 3600, // Keep failed jobs for 7 days
            },
        },
    },
    orderExpiry: {
        name: 'order-expiry',
        defaultJobOptions: {
            attempts: 2,
            backoff: {
                type: 'fixed',
                delay: 5000, // 5 seconds
            },
            removeOnComplete: {
                age: 24 * 3600,
                count: 500,
            },
            removeOnFail: {
                age: 7 * 24 * 3600,
            },
        },
    },
    vendorFallback: {
        name: 'vendor-fallback',
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 3000, // 3s, 6s, 12s
            },
            removeOnComplete: {
                age: 24 * 3600,
                count: 500,
            },
            removeOnFail: {
                age: 7 * 24 * 3600,
            },
        },
    },
    dailyReports: {
        name: 'daily-reports',
        defaultJobOptions: {
            attempts: 2,
            backoff: {
                type: 'fixed',
                delay: 10000, // 10 seconds
            },
            removeOnComplete: {
                age: 30 * 24 * 3600, // Keep for 30 days
                count: 100,
            },
            removeOnFail: {
                age: 30 * 24 * 3600,
            },
        },
    },
    creditReconciliation: {
        name: 'credit-reconciliation',
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000, // 5s, 10s, 20s
            },
            removeOnComplete: {
                age: 30 * 24 * 3600,
                count: 200,
            },
            removeOnFail: {
                age: 30 * 24 * 3600,
            },
        },
    },
};

// Create queues
const queues = {};
const queueEvents = {};

for (const [key, config] of Object.entries(queueConfigs)) {
    queues[key] = new Queue(config.name, {
        connection,
        defaultJobOptions: config.defaultJobOptions,
    });

    queueEvents[key] = new QueueEvents(config.name, {
        connection,
    });
}

// Dead-letter queue for failed jobs
const deadLetterQueue = new Queue('dead-letter-queue', {
    connection,
    defaultJobOptions: {
        removeOnComplete: false, // Never remove from DLQ
        removeOnFail: false,
    },
});

// Test Redis connection
async function testConnection() {
    try {
        await connection.ping();
        console.log('✅ Redis connection established');
        return true;
    } catch (error) {
        console.error('❌ Redis connection failed:', error.message);
        return false;
    }
}

// Graceful shutdown
async function closeConnections() {
    await Promise.all([
        ...Object.values(queues).map(queue => queue.close()),
        ...Object.values(queueEvents).map(events => events.close()),
        deadLetterQueue.close(),
        connection.quit(),
    ]);
    console.log('✅ All queue connections closed');
}

module.exports = {
    connection,
    queues,
    queueEvents,
    deadLetterQueue,
    testConnection,
    closeConnections,
    queueConfigs,
};
