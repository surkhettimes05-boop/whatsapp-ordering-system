/**
 * Queue Management Routes
 */

const express = require('express');
const router = express.Router();
const queueController = require('../controllers/queue.controller');
// const { authenticate, authorize } = require('../middleware/auth.middleware');
// const { isAdmin } = require('../middleware/admin.middleware');

// Get all queue metrics
router.get('/metrics', queueController.getAllMetrics);

// Get specific queue metrics
router.get('/metrics/:queueName', queueController.getQueueMetric);

// Get dead-letter queue jobs
router.get('/dead-letter/:queueName', queueController.getDeadLetter);

// Retry failed job
router.post('/retry/:queueName/:jobId', queueController.retryFailedJob);

// Clean failed jobs
router.post('/clean/:queueName', queueController.cleanFailed);

// Get job types
router.get('/job-types', queueController.getJobTypes);

// Get monitoring dashboard
router.get('/dashboard', queueController.getDashboard);

module.exports = router;
