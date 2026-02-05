/**
 * Launch Control Routes
 * API routes for platform control management
 */

const express = require('express');
const launchControlController = require('../controllers/launch-control.controller');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');

const router = express.Router();

// Apply authentication and admin middleware to all routes
router.use(authMiddleware);
router.use(adminMiddleware);

// Get all launch controls
router.get('/controls', launchControlController.getControls);

// Update a specific control
router.put('/controls', launchControlController.updateControl);

// Get available presets
router.get('/presets', launchControlController.getPresets);

// Apply a preset
router.post('/presets/apply', launchControlController.applyPreset);

// Get platform metrics
router.get('/metrics', launchControlController.getMetrics);

// Get audit log
router.get('/audit', launchControlController.getAuditLog);

// Emergency controls
router.post('/emergency/stop', launchControlController.emergencyStop);
router.post('/emergency/resume', launchControlController.resumeOperations);

module.exports = router;