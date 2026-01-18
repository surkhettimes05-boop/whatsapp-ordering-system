const express = require('express');
const router = express.Router();
const reportingController = require('../controllers/reporting.controller');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');

// Protect all reporting routes with Admin middleware
router.get('/export', authenticate, isAdmin, reportingController.exportData);

module.exports = router;
