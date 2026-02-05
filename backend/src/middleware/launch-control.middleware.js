/**
 * Launch Control Middleware
 * Enforces platform limits and controls
 */

const launchControlService = require('../services/launch-control.service');
const logger = require('../utils/logger');

const launchControlMiddleware = {
  // Check if emergency stop is active
  checkEmergencyStop: (req, res, next) => {
    if (launchControlService.isEmergencyStop()) {
      logger.warn('Request blocked - Emergency stop active', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(503).json({
        success: false,
        error: 'Platform is currently under emergency stop',
        code: 'EMERGENCY_STOP'
      });
    }
    next();
  },

  // Check if maintenance mode is active
  checkMaintenanceMode: (req, res, next) => {
    if (launchControlService.isMaintenanceMode()) {
      logger.warn('Request blocked - Maintenance mode active', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(503).json({
        success: false,
        error: 'Platform is currently under maintenance',
        code: 'MAINTENANCE_MODE'
      });
    }
    next();
  },

  // Check if read-only mode is active (blocks write operations)
  checkReadOnlyMode: (req, res, next) => {
    const writeOperations = ['POST', 'PUT', 'PATCH', 'DELETE'];
    
    if (launchControlService.isReadOnlyMode() && writeOperations.includes(req.method)) {
      logger.warn('Write operation blocked - Read-only mode active', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(503).json({
        success: false,
        error: 'Platform is currently in read-only mode',
        code: 'READ_ONLY_MODE'
      });
    }
    next();
  },

  // Check daily order limit
  checkDailyOrderLimit: async (req, res, next) => {
    try {
      const withinLimit = await launchControlService.checkDailyOrderLimit();
      
      if (!withinLimit) {
        logger.warn('Order blocked - Daily limit reached', {
          path: req.path,
          ip: req.ip
        });
        
        return res.status(429).json({
          success: false,
          error: 'Daily order limit reached',
          code: 'DAILY_LIMIT_EXCEEDED'
        });
      }
      next();
    } catch (error) {
      logger.error('Failed to check daily order limit', { error: error.message });
      next(); // Allow request to proceed if check fails
    }
  },

  // Check concurrent order limit
  checkConcurrentOrderLimit: async (req, res, next) => {
    try {
      const withinLimit = await launchControlService.checkConcurrentOrderLimit();
      
      if (!withinLimit) {
        logger.warn('Order blocked - Concurrent limit reached', {
          path: req.path,
          ip: req.ip
        });
        
        return res.status(429).json({
          success: false,
          error: 'Too many concurrent orders',
          code: 'CONCURRENT_LIMIT_EXCEEDED'
        });
      }
      next();
    } catch (error) {
      logger.error('Failed to check concurrent order limit', { error: error.message });
      next(); // Allow request to proceed if check fails
    }
  },

  // Check if new retailer signup is enabled
  checkNewRetailerSignup: (req, res, next) => {
    if (!launchControlService.getControl('ENABLE_NEW_RETAILER_SIGNUP')) {
      logger.warn('Retailer signup blocked - Feature disabled', {
        path: req.path,
        ip: req.ip
      });
      
      return res.status(403).json({
        success: false,
        error: 'New retailer signup is currently disabled',
        code: 'SIGNUP_DISABLED'
      });
    }
    next();
  },

  // Check if admin approval is required
  checkAdminApproval: (req, res, next) => {
    if (launchControlService.getControl('ADMIN_APPROVAL_REQUIRED')) {
      // Add flag to request for downstream processing
      req.requiresAdminApproval = true;
    }
    next();
  },

  // Comprehensive launch control check for orders
  orderLaunchControl: [
    function(req, res, next) { launchControlMiddleware.checkEmergencyStop(req, res, next); },
    function(req, res, next) { launchControlMiddleware.checkMaintenanceMode(req, res, next); },
    function(req, res, next) { launchControlMiddleware.checkReadOnlyMode(req, res, next); },
    function(req, res, next) { launchControlMiddleware.checkDailyOrderLimit(req, res, next); },
    function(req, res, next) { launchControlMiddleware.checkConcurrentOrderLimit(req, res, next); },
    function(req, res, next) { launchControlMiddleware.checkAdminApproval(req, res, next); }
  ],

  // Basic launch control check for general operations
  basicLaunchControl: [
    function(req, res, next) { launchControlMiddleware.checkEmergencyStop(req, res, next); },
    function(req, res, next) { launchControlMiddleware.checkMaintenanceMode(req, res, next); },
    function(req, res, next) { launchControlMiddleware.checkReadOnlyMode(req, res, next); }
  ]
};

module.exports = launchControlMiddleware;