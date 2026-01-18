/**
 * Queue Monitoring and Metrics
 * 
 * Provides metrics and monitoring for job queues
 */

const { queues, queueEvents, deadLetterQueue } = require('./queue.config');

/**
 * Get queue metrics
 * @param {string} queueName - Queue name
 * @returns {Promise<object>} - Queue metrics
 */
async function getQueueMetrics(queueName) {
    const queue = queues[queueName];
    if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
    ]);

    const dlqCount = queueName !== 'dead-letter-queue' 
        ? await deadLetterQueue.getWaitingCount() 
        : 0;

    return {
        queue: queueName,
        waiting,
        active,
        completed,
        failed,
        delayed,
        deadLetter: dlqCount,
        total: waiting + active + completed + failed + delayed,
    };
}

/**
 * Get all queue metrics
 * @returns {Promise<object>} - All queue metrics
 */
async function getAllMetrics() {
    const queueNames = Object.keys(queues);
    const metrics = await Promise.all(
        queueNames.map(name => getQueueMetrics(name))
    );

    const total = metrics.reduce(
        (acc, m) => ({
            waiting: acc.waiting + m.waiting,
            active: acc.active + m.active,
            completed: acc.completed + m.completed,
            failed: acc.failed + m.failed,
            delayed: acc.delayed + m.delayed,
            deadLetter: acc.deadLetter + m.deadLetter,
        }),
        { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, deadLetter: 0 }
    );

    return {
        queues: metrics,
        totals: total,
        timestamp: new Date().toISOString(),
    };
}

/**
 * Get job details
 * @param {string} queueName - Queue name
 * @param {string} jobId - Job ID
 * @returns {Promise<object>} - Job details
 */
async function getJobDetails(queueName, jobId) {
    const queue = queues[queueName];
    if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
        throw new Error(`Job ${jobId} not found in queue ${queueName}`);
    }

    const state = await job.getState();
    const progress = job.progress;

    return {
        id: job.id,
        name: job.name,
        data: job.data,
        state,
        progress,
        attemptsMade: job.attemptsMade,
        opts: job.opts,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
    };
}

/**
 * Get failed jobs
 * @param {string} queueName - Queue name
 * @param {number} limit - Limit
 * @returns {Promise<Array>} - Failed jobs
 */
async function getFailedJobs(queueName, limit = 50) {
    const queue = queues[queueName];
    if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
    }

    const jobs = await queue.getFailed(0, limit - 1);
    return jobs.map((job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
    }));
}

/**
 * Get dead-letter queue jobs
 * @param {number} limit - Limit
 * @returns {Promise<Array>} - DLQ jobs
 */
async function getDeadLetterJobs(limit = 50) {
    const jobs = await deadLetterQueue.getWaiting(0, limit - 1);
    return jobs.map((job) => ({
        id: job.id,
        data: job.data,
        timestamp: job.timestamp,
    }));
}

/**
 * Retry failed job
 * @param {string} queueName - Queue name
 * @param {string} jobId - Job ID
 * @returns {Promise<object>} - Result
 */
async function retryJob(queueName, jobId) {
    const queue = queues[queueName];
    if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
        throw new Error(`Job ${jobId} not found`);
    }

    await job.retry();
    return {
        success: true,
        jobId,
        message: 'Job queued for retry',
    };
}

/**
 * Remove job
 * @param {string} queueName - Queue name
 * @param {string} jobId - Job ID
 * @returns {Promise<object>} - Result
 */
async function removeJob(queueName, jobId) {
    const queue = queues[queueName];
    if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
        throw new Error(`Job ${jobId} not found`);
    }

    await job.remove();
    return {
        success: true,
        jobId,
        message: 'Job removed',
    };
}

module.exports = {
    getQueueMetrics,
    getAllMetrics,
    getJobDetails,
    getFailedJobs,
    getDeadLetterJobs,
    retryJob,
    removeJob,
};
