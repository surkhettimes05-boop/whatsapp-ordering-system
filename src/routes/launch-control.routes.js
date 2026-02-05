// =============================================================================
// LAUNCH CONTROL ROUTES
// Growth & Risk Engineering - API Routes for Real-time Control
// =============================================================================

const express = require('express');
const LaunchControlController = require('../controllers/launch-control.controller');
const { authenticateJWT } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const { auditLog } = require('../middleware/audit.middleware');

const router = express.Router();
const launchControlController = new LaunchControlController();

// Apply authentication and admin role requirement to all routes
router.use(authenticateJWT);
router.use(requireRole(['ADMIN', 'SUPER_ADMIN']));
router.use(auditLog('launch_control'));

// =============================================================================
// FLAG MANAGEMENT ROUTES
// =============================================================================

// Get all launch control flags
router.get('/flags', 
  launchControlController.getFlags.bind(launchControlController)
);

// Get specific flag
router.get('/flags/:key', 
  launchControlController.getFlag.bind(launchControlController)
);

// Update single flag
router.put('/flags/:key', 
  launchControlController.updateFlag.bind(launchControlController)
);

// Update multiple flags (bulk update)
router.put('/flags', 
  launchControlController.updateFlags.bind(launchControlController)
);

// Get flag change history
router.get('/flags/:key/history', 
  launchControlController.getFlagHistory.bind(launchControlController)
);

// =============================================================================
// SYSTEM METRICS ROUTES
// =============================================================================

// Get current system metrics
router.get('/metrics', 
  launchControlController.getSystemMetrics.bind(launchControlController)
);

// Get dashboard data (flags + metrics + alerts)
router.get('/dashboard', 
  launchControlController.getDashboardData.bind(launchControlController)
);

// =============================================================================
// EMERGENCY CONTROLS
// =============================================================================

// Emergency stop (requires SUPER_ADMIN)
router.post('/emergency-stop', 
  requireRole(['SUPER_ADMIN']),
  launchControlController.emergencyStop.bind(launchControlController)
);

// Resume operations (requires SUPER_ADMIN)
router.post('/resume-operations', 
  requireRole(['SUPER_ADMIN']),
  launchControlController.resumeOperations.bind(launchControlController)
);

// =============================================================================
// HEALTH CHECK
// =============================================================================

// Launch control system health check
router.get('/health', 
  launchControlController.healthCheck.bind(launchControlController)
);

// =============================================================================
// PRESET CONFIGURATIONS
// =============================================================================

// Apply launch phase presets
router.post('/presets/launch-phase', async (req, res) => {
  try {
    const { phase } = req.body; // 'soft-launch', 'beta', 'full-launch'
    const updatedBy = req.user?.email || req.user?.id || 'admin';
    
    let presetFlags = {};
    
    switch (phase) {
      case 'soft-launch':
        presetFlags = {
          MAX_DAILY_ORDERS: 50,
          MAX_ACTIVE_RETAILERS: 20,
          MAX_ACTIVE_VENDORS: 10,
          MAX_CREDIT_PER_RETAILER: 25000,
          ADMIN_APPROVAL_REQUIRED: true,
          ENABLE_NEW_RETAILER_SIGNUP: true,
          ENABLE_NEW_VENDOR_SIGNUP: false,
          REQUIRE_PHONE_VERIFICATION: true
        };
        break;
        
      case 'beta':
        presetFlags = {
          MAX_DAILY_ORDERS: 200,
          MAX_ACTIVE_RETAILERS: 100,
          MAX_ACTIVE_VENDORS: 30,
          MAX_CREDIT_PER_RETAILER: 50000,
          ADMIN_APPROVAL_REQUIRED: false,
          ENABLE_NEW_RETAILER_SIGNUP: true,
          ENABLE_NEW_VENDOR_SIGNUP: true,
          REQUIRE_PHONE_VERIFICATION: true
        };
        break;
        
      case 'full-launch':
        presetFlags = {
          MAX_DAILY_ORDERS: 1000,
          MAX_ACTIVE_RETAILERS: 500,
          MAX_ACTIVE_VENDORS: 100,
          MAX_CREDIT_PER_RETAILER: 100000,
          ADMIN_APPROVAL_REQUIRED: false,
          ENABLE_NEW_RETAILER_SIGNUP: true,
          ENABLE_NEW_VENDOR_SIGNUP: true,
          REQUIRE_PHONE_VERIFICATION: false
        };
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'INVALID_PHASE',
          message: 'Valid phases are: soft-launch, beta, full-launch'
        });
    }
    
    const results = await launchControlController.launchControl.updateFlags(presetFlags, updatedBy);
    
    res.json({
      success: true,
      message: `${phase} preset applied successfully`,
      data: {
        phase,
        appliedFlags: presetFlags,
        results,
        appliedBy: updatedBy,
        appliedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'PRESET_FAILED',
      message: 'Failed to apply launch phase preset'
    });
  }
});

// Apply risk level presets
router.post('/presets/risk-level', async (req, res) => {
  try {
    const { level } = req.body; // 'conservative', 'moderate', 'aggressive'
    const updatedBy = req.user?.email || req.user?.id || 'admin';
    
    let presetFlags = {};
    
    switch (level) {
      case 'conservative':
        presetFlags = {
          MAX_CREDIT_UTILIZATION_PERCENT: 60,
          MAX_ORDERS_PER_RETAILER_DAILY: 5,
          ENABLE_FRAUD_DETECTION: true,
          REQUIRE_PHONE_VERIFICATION: true,
          ADMIN_APPROVAL_REQUIRED: true
        };
        break;
        
      case 'moderate':
        presetFlags = {
          MAX_CREDIT_UTILIZATION_PERCENT: 80,
          MAX_ORDERS_PER_RETAILER_DAILY: 10,
          ENABLE_FRAUD_DETECTION: true,
          REQUIRE_PHONE_VERIFICATION: true,
          ADMIN_APPROVAL_REQUIRED: false
        };
        break;
        
      case 'aggressive':
        presetFlags = {
          MAX_CREDIT_UTILIZATION_PERCENT: 95,
          MAX_ORDERS_PER_RETAILER_DAILY: 20,
          ENABLE_FRAUD_DETECTION: false,
          REQUIRE_PHONE_VERIFICATION: false,
          ADMIN_APPROVAL_REQUIRED: false
        };
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'INVALID_LEVEL',
          message: 'Valid levels are: conservative, moderate, aggressive'
        });
    }
    
    const results = await launchControlController.launchControl.updateFlags(presetFlags, updatedBy);
    
    res.json({
      success: true,
      message: `${level} risk level preset applied successfully`,
      data: {
        level,
        appliedFlags: presetFlags,
        results,
        appliedBy: updatedBy,
        appliedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'PRESET_FAILED',
      message: 'Failed to apply risk level preset'
    });
  }
});

module.exports = router;