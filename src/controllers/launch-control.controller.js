// =============================================================================
// LAUNCH CONTROL CONTROLLER
// Growth & Risk Engineering - API Endpoints for Real-time Control
// =============================================================================

const LaunchControlConfig = require('../config/launch-control.config');
const logger = require('../infrastructure/logger');

class LaunchControlController {
  constructor() {
    this.launchControl = new LaunchControlConfig();
  }

  // Get all launch control flags
  async getFlags(req, res) {
    try {
      const flags = await this.launchControl.getFlags();
      
      res.json({
        success: true,
        data: flags,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting launch control flags:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve launch control flags'
      });
    }
  }

  // Get specific flag
  async getFlag(req, res) {
    try {
      const { key } = req.params;
      const value = await this.launchControl.getFlag(key);
      
      if (value === undefined) {
        return res.status(404).json({
          success: false,
          error: 'FLAG_NOT_FOUND',
          message: `Launch control flag '${key}' not found`
        });
      }
      
      res.json({
        success: true,
        data: {
          key,
          value,
          type: typeof value
        }
      });
    } catch (error) {
      logger.error(`Error getting launch control flag ${req.params.key}:`, error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve launch control flag'
      });
    }
  }

  // Update single flag
  async updateFlag(req, res) {
    try {
      const { key } = req.params;
      const { value, reason } = req.body;
      const updatedBy = req.user?.email || req.user?.id || 'admin';
      
      if (value === undefined) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_VALUE',
          message: 'Flag value is required'
        });
      }

      await this.launchControl.updateFlag(key, value, updatedBy);
      
      // Log the change with reason
      logger.info(`Launch control flag updated: ${key} = ${value} by ${updatedBy}${reason ? ` (${reason})` : ''}`);
      
      res.json({
        success: true,
        message: `Launch control flag '${key}' updated successfully`,
        data: {
          key,
          value,
          updatedBy,
          updatedAt: new Date().toISOString(),
          reason
        }
      });
    } catch (error) {
      logger.error(`Error updating launch control flag ${req.params.key}:`, error);
      res.status(500).json({
        success: false,
        error: 'UPDATE_FAILED',
        message: 'Failed to update launch control flag'
      });
    }
  }

  // Update multiple flags
  async updateFlags(req, res) {
    try {
      const { flags, reason } = req.body;
      const updatedBy = req.user?.email || req.user?.id || 'admin';
      
      if (!flags || typeof flags !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'INVALID_FLAGS',
          message: 'Flags object is required'
        });
      }

      const results = await this.launchControl.updateFlags(flags, updatedBy);
      
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      logger.info(`Bulk flag update: ${successful.length} successful, ${failed.length} failed by ${updatedBy}${reason ? ` (${reason})` : ''}`);
      
      res.json({
        success: failed.length === 0,
        message: `Updated ${successful.length} flags successfully${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
        data: {
          successful: successful.map(r => r.key),
          failed: failed.map(r => ({ key: r.key, error: r.error })),
          updatedBy,
          updatedAt: new Date().toISOString(),
          reason
        }
      });
    } catch (error) {
      logger.error('Error updating multiple launch control flags:', error);
      res.status(500).json({
        success: false,
        error: 'BULK_UPDATE_FAILED',
        message: 'Failed to update launch control flags'
      });
    }
  }

  // Get system metrics for dashboard
  async getSystemMetrics(req, res) {
    try {
      const metrics = await this.launchControl.getSystemMetrics();
      
      if (!metrics) {
        return res.status(500).json({
          success: false,
          error: 'METRICS_UNAVAILABLE',
          message: 'System metrics are currently unavailable'
        });
      }
      
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting system metrics:', error);
      res.status(500).json({
        success: false,
        error: 'METRICS_ERROR',
        message: 'Failed to retrieve system metrics'
      });
    }
  }

  // Emergency stop
  async emergencyStop(req, res) {
    try {
      const { reason } = req.body;
      const updatedBy = req.user?.email || req.user?.id || 'admin';
      
      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'REASON_REQUIRED',
          message: 'Emergency stop reason is required'
        });
      }

      await this.launchControl.emergencyStop(reason, updatedBy);
      
      res.json({
        success: true,
        message: 'Emergency stop activated successfully',
        data: {
          reason,
          activatedBy: updatedBy,
          activatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error activating emergency stop:', error);
      res.status(500).json({
        success: false,
        error: 'EMERGENCY_STOP_FAILED',
        message: 'Failed to activate emergency stop'
      });
    }
  }

  // Resume operations
  async resumeOperations(req, res) {
    try {
      const { reason } = req.body;
      const updatedBy = req.user?.email || req.user?.id || 'admin';

      await this.launchControl.resumeOperations(updatedBy);
      
      logger.info(`Operations resumed by ${updatedBy}${reason ? ` (${reason})` : ''}`);
      
      res.json({
        success: true,
        message: 'Operations resumed successfully',
        data: {
          resumedBy: updatedBy,
          resumedAt: new Date().toISOString(),
          reason
        }
      });
    } catch (error) {
      logger.error('Error resuming operations:', error);
      res.status(500).json({
        success: false,
        error: 'RESUME_FAILED',
        message: 'Failed to resume operations'
      });
    }
  }

  // Get flag change history
  async getFlagHistory(req, res) {
    try {
      const { key } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      
      const history = await this.launchControl.prisma.launchControlFlagHistory.findMany({
        where: {
          flag: {
            key: key
          }
        },
        orderBy: {
          changedAt: 'desc'
        },
        take: parseInt(limit),
        skip: parseInt(offset),
        include: {
          flag: {
            select: {
              key: true,
              description: true
            }
          }
        }
      });
      
      res.json({
        success: true,
        data: history,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: history.length
        }
      });
    } catch (error) {
      logger.error(`Error getting flag history for ${req.params.key}:`, error);
      res.status(500).json({
        success: false,
        error: 'HISTORY_ERROR',
        message: 'Failed to retrieve flag change history'
      });
    }
  }

  // Health check for launch control system
  async healthCheck(req, res) {
    try {
      const flags = await this.launchControl.getFlags();
      const metrics = await this.launchControl.getSystemMetrics();
      
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        flags: {
          total: Object.keys(flags).length,
          lastUpdated: flags.LAST_UPDATED,
          emergencyStop: flags.EMERGENCY_STOP,
          maintenanceMode: flags.MAINTENANCE_MODE,
          readonlyMode: flags.READONLY_MODE
        },
        metrics: metrics ? {
          dailyOrdersUtilization: metrics.dailyOrders.utilization,
          retailerUtilization: metrics.activeRetailers.utilization,
          vendorUtilization: metrics.activeVendors.utilization,
          creditUtilization: metrics.creditExposure.utilization
        } : null
      };
      
      // Check for critical conditions
      if (flags.EMERGENCY_STOP || flags.MAINTENANCE_MODE) {
        health.status = 'degraded';
        health.warnings = [];
        
        if (flags.EMERGENCY_STOP) {
          health.warnings.push('System is in emergency stop mode');
        }
        if (flags.MAINTENANCE_MODE) {
          health.warnings.push('System is in maintenance mode');
        }
      }
      
      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      logger.error('Launch control health check failed:', error);
      res.status(500).json({
        success: false,
        error: 'HEALTH_CHECK_FAILED',
        message: 'Launch control health check failed'
      });
    }
  }

  // Get launch control dashboard data
  async getDashboardData(req, res) {
    try {
      const [flags, metrics] = await Promise.all([
        this.launchControl.getFlags(),
        this.launchControl.getSystemMetrics()
      ]);
      
      // Calculate risk scores
      const riskScore = this.calculateRiskScore(metrics);
      
      // Get recent alerts (if implemented)
      const recentAlerts = []; // Placeholder for alert system
      
      res.json({
        success: true,
        data: {
          flags,
          metrics,
          riskScore,
          alerts: recentAlerts,
          systemStatus: {
            emergencyStop: flags.EMERGENCY_STOP,
            maintenanceMode: flags.MAINTENANCE_MODE,
            readonlyMode: flags.READONLY_MODE,
            overallHealth: riskScore < 70 ? 'healthy' : riskScore < 85 ? 'warning' : 'critical'
          },
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error getting dashboard data:', error);
      res.status(500).json({
        success: false,
        error: 'DASHBOARD_ERROR',
        message: 'Failed to retrieve dashboard data'
      });
    }
  }

  // Calculate risk score based on current metrics
  calculateRiskScore(metrics) {
    if (!metrics) return 0;
    
    let riskScore = 0;
    
    // Daily orders utilization (weight: 25%)
    riskScore += (metrics.dailyOrders.utilization * 0.25);
    
    // Retailer utilization (weight: 20%)
    riskScore += (metrics.activeRetailers.utilization * 0.20);
    
    // Vendor utilization (weight: 15%)
    riskScore += (metrics.activeVendors.utilization * 0.15);
    
    // Credit exposure (weight: 30%)
    riskScore += (metrics.creditExposure.utilization * 0.30);
    
    // Concurrent orders (weight: 10%)
    riskScore += (metrics.concurrentOrders.utilization * 0.10);
    
    return Math.round(riskScore);
  }
}

module.exports = LaunchControlController;