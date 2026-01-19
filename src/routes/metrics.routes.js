/**
 * Metrics Routes
 * 
 * Endpoints for metrics and health monitoring
 */

const express = require('express');
const router = express.Router();
const metricsController = require('../controllers/metrics.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../config/permissions');

// Public health check (no auth required)
router.get('/health', metricsController.getHealth);

// Metrics endpoint (admin only)
router.get('/metrics',
    authenticate,
    requirePermission('system:health'),
    metricsController.getMetrics
);

module.exports = router;
