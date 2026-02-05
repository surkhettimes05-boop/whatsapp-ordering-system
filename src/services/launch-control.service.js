// =============================================================================
// LAUNCH CONTROL SERVICE
// Growth & Risk Engineering - Service Integration Layer
// =============================================================================

const LaunchControlConfig = require('../config/launch-control.config');
const logger = require('../infrastructure/logger');

class LaunchControlService {
  constructor() {
    this.launchControl = new LaunchControlConfig();
  }

  // Check if order creation is allowed
  async canCreateOrder(retailerId, orderValue) {
    try {
      // Check emergency stop
      const emergencyStop = await this.launchControl.getFlag('EMERGENCY_STOP');
      if (emergencyStop) {
        return {
          allowed: false,
          reason: 'EMERGENCY_STOP',
          message: 'System is in emergency stop mode'
        };
      }

      // Check maintenance mode
      const maintenanceMode = await this.launchControl.getFlag('MAINTENANCE_MODE');
      if (maintenanceMode) {
        return {
          allowed: false,
          reason: 'MAINTENANCE_MODE',
          message: 'System is under maintenance'
        };
      }

      // Check daily order limit
      const dailyOrders = await this.launchControl.getDailyOrderCount();
      const maxDailyOrders = await this.launchControl.getFlag('MAX_DAILY_ORDERS');
      if (dailyOrders >= maxDailyOrders) {
        return {
          allowed: false,
          reason: 'DAILY_LIMIT_EXCEEDED',
          message: 'Daily order limit reached',
          current: dailyOrders,
          limit: maxDailyOrders
        };
      }

      // Check order value limit
      const maxOrderValue = await this.launchControl.getFlag('MAX_ORDER_VALUE');
      if (orderValue > maxOrderValue) {
        return {
          allowed: false,
          reason: 'ORDER_VALUE_EXCEEDED',
          message: 'Order value exceeds maximum limit',
          orderValue,
          limit: maxOrderValue
        };
      }

      // Check retailer daily order limit
      const retailerDailyOrders = await this.getRetailerDailyOrderCount(retailerId);
      const maxRetailerDailyOrders = await this.launchControl.getFlag('MAX_ORDERS_PER_RETAILER_DAILY');
      if (retailerDailyOrders >= maxRetailerDailyOrders) {
        return {
          allowed: false,
          reason: 'RETAILER_DAILY_LIMIT_EXCEEDED',
          message: 'Retailer daily order limit reached',
          current: retailerDailyOrders,
          limit: maxRetailerDailyOrders
        };
      }

      // Check concurrent orders
      const concurrentOrders = await this.launchControl.getConcurrentOrderCount();
      const maxConcurrentOrders = await this.launchControl.getFlag('MAX_CONCURRENT_ORDERS');
      if (concurrentOrders >= maxConcurrentOrders) {
        return {
          allowed: false,
          reason: 'CONCURRENT_LIMIT_EXCEEDED',
          message: 'Maximum concurrent orders reached',
          current: concurrentOrders,
          limit: maxConcurrentOrders
        };
      }

      return {
        allowed: true,
        requiresApproval: await this.launchControl.getFlag('ADMIN_APPROVAL_REQUIRED')
      };
    } catch (error) {
      logger.error('Error checking order creation limits:', error);
      // Fail open - allow order creation if check fails
      return { allowed: true };
    }
  }

  // Check if retailer registration is allowed
  async canRegisterRetailer() {
    try {
      // Check if new retailer signup is enabled
      const signupEnabled = await this.launchControl.getFlag('ENABLE_NEW_RETAILER_SIGNUP');
      if (!signupEnabled) {
        return {
          allowed: false,
          reason: 'SIGNUP_DISABLED',
          message: 'New retailer registration is currently disabled'
        };
      }

      // Check retailer limit
      const activeRetailers = await this.launchControl.getActiveRetailerCount();
      const maxActiveRetailers = await this.launchControl.getFlag('MAX_ACTIVE_RETAILERS');
      if (activeRetailers >= maxActiveRetailers) {
        return {
          allowed: false,
          reason: 'RETAILER_LIMIT_EXCEEDED',
          message: 'Maximum number of active retailers reached',
          current: activeRetailers,
          limit: maxActiveRetailers
        };
      }

      return {
        allowed: true,
        requiresApproval: await this.launchControl.getFlag('ADMIN_APPROVAL_REQUIRED'),
        requiresPhoneVerification: await this.launchControl.getFlag('REQUIRE_PHONE_VERIFICATION')
      };
    } catch (error) {
      logger.error('Error checking retailer registration limits:', error);
      return { allowed: true };
    }
  }

  // Check if vendor registration is allowed
  async canRegisterVendor() {
    try {
      // Check if new vendor signup is enabled
      const signupEnabled = await this.launchControl.getFlag('ENABLE_NEW_VENDOR_SIGNUP');
      if (!signupEnabled) {
        return {
          allowed: false,
          reason: 'SIGNUP_DISABLED',
          message: 'New vendor registration is currently disabled'
        };
      }

      // Check vendor limit
      const activeVendors = await this.launchControl.getActiveVendorCount();
      const maxActiveVendors = await this.launchControl.getFlag('MAX_ACTIVE_VENDORS');
      if (activeVendors >= maxActiveVendors) {
        return {
          allowed: false,
          reason: 'VENDOR_LIMIT_EXCEEDED',
          message: 'Maximum number of active vendors reached',
          current: activeVendors,
          limit: maxActiveVendors
        };
      }

      return {
        allowed: true,
        requiresApproval: await this.launchControl.getFlag('ADMIN_APPROVAL_REQUIRED')
      };
    } catch (error) {
      logger.error('Error checking vendor registration limits:', error);
      return { allowed: true };
    }
  }

  // Check if credit extension is allowed
  async canExtendCredit(retailerId, creditAmount, currentCredit = 0) {
    try {
      // Check if credit system is enabled
      const creditSystemEnabled = await this.launchControl.getFlag('ENABLE_CREDIT_SYSTEM');
      if (!creditSystemEnabled) {
        return {
          allowed: false,
          reason: 'CREDIT_SYSTEM_DISABLED',
          message: 'Credit system is currently disabled'
        };
      }

      // Check per-retailer credit limit
      const maxCreditPerRetailer = await this.launchControl.getFlag('MAX_CREDIT_PER_RETAILER');
      const totalCredit = currentCredit + creditAmount;
      if (totalCredit > maxCreditPerRetailer) {
        return {
          allowed: false,
          reason: 'CREDIT_LIMIT_EXCEEDED',
          message: 'Credit amount exceeds maximum limit per retailer',
          requested: totalCredit,
          limit: maxCreditPerRetailer
        };
      }

      // Check credit utilization percentage
      const maxUtilization = await this.launchControl.getFlag('MAX_CREDIT_UTILIZATION_PERCENT');
      const utilizationPercent = (totalCredit / maxCreditPerRetailer) * 100;
      if (utilizationPercent > maxUtilization) {
        return {
          allowed: false,
          reason: 'UTILIZATION_EXCEEDED',
          message: 'Credit utilization exceeds maximum allowed percentage',
          utilization: utilizationPercent,
          maxUtilization
        };
      }

      return {
        allowed: true,
        requiresApproval: await this.launchControl.getFlag('ADMIN_APPROVAL_REQUIRED')
      };
    } catch (error) {
      logger.error('Error checking credit extension limits:', error);
      return { allowed: true };
    }
  }

  // Check if feature is enabled
  async isFeatureEnabled(featureName) {
    try {
      return await this.launchControl.getFlag(featureName);
    } catch (error) {
      logger.error(`Error checking feature flag ${featureName}:`, error);
      return true; // Fail open
    }
  }

  // Get retailer daily order count
  async getRetailerDailyOrderCount(retailerId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return await this.launchControl.prisma.order.count({
      where: {
        retailerId,
        createdAt: {
          gte: today
        }
      }
    });
  }

  // Record system metric
  async recordMetric(metricName, value, tags = {}) {
    try {
      await this.launchControl.prisma.systemMetrics.create({
        data: {
          metricName,
          metricValue: parseFloat(value),
          metricType: 'gauge',
          tags,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error(`Error recording metric ${metricName}:`, error);
    }
  }

  // Create launch control alert
  async createAlert(alertType, severity, title, message, details = {}) {
    try {
      await this.launchControl.prisma.launchControlAlert.create({
        data: {
          alertType,
          severity,
          title,
          message,
          details,
          status: 'ACTIVE'
        }
      });

      logger.warn(`Launch control alert created: ${alertType} - ${title}`);
    } catch (error) {
      logger.error('Error creating launch control alert:', error);
    }
  }

  // Check and create alerts based on current metrics
  async checkAndCreateAlerts() {
    try {
      const metrics = await this.launchControl.getSystemMetrics();
      if (!metrics) return;

      // Check high order volume
      const alertOnHighVolume = await this.launchControl.getFlag('ALERT_ON_HIGH_ORDER_VOLUME');
      const highVolumeThreshold = await this.launchControl.getFlag('HIGH_ORDER_VOLUME_THRESHOLD');
      
      if (alertOnHighVolume && metrics.dailyOrders.utilization >= highVolumeThreshold) {
        await this.createAlert(
          'HIGH_ORDER_VOLUME',
          'MEDIUM',
          'High Order Volume Detected',
          `Daily order utilization is at ${metrics.dailyOrders.utilization}%`,
          { utilization: metrics.dailyOrders.utilization, threshold: highVolumeThreshold }
        );
      }

      // Check high credit exposure
      if (metrics.creditExposure.utilization >= 90) {
        await this.createAlert(
          'HIGH_CREDIT_EXPOSURE',
          'HIGH',
          'High Credit Exposure',
          `Credit exposure is at ${metrics.creditExposure.utilization}%`,
          { utilization: metrics.creditExposure.utilization }
        );
      }

      // Check retailer capacity
      if (metrics.activeRetailers.utilization >= 95) {
        await this.createAlert(
          'RETAILER_CAPACITY_CRITICAL',
          'CRITICAL',
          'Retailer Capacity Critical',
          `Active retailer capacity is at ${metrics.activeRetailers.utilization}%`,
          { utilization: metrics.activeRetailers.utilization }
        );
      }

    } catch (error) {
      logger.error('Error checking and creating alerts:', error);
    }
  }

  // Get system health status
  async getSystemHealth() {
    try {
      const flags = await this.launchControl.getFlags();
      const metrics = await this.launchControl.getSystemMetrics();
      
      let status = 'healthy';
      const issues = [];
      
      if (flags.EMERGENCY_STOP) {
        status = 'critical';
        issues.push('Emergency stop is active');
      }
      
      if (flags.MAINTENANCE_MODE) {
        status = status === 'critical' ? 'critical' : 'degraded';
        issues.push('System is in maintenance mode');
      }
      
      if (metrics) {
        if (metrics.dailyOrders.utilization >= 95) {
          status = status === 'critical' ? 'critical' : 'degraded';
          issues.push('Daily order capacity critical');
        }
        
        if (metrics.creditExposure.utilization >= 90) {
          status = status === 'critical' ? 'critical' : 'degraded';
          issues.push('Credit exposure high');
        }
      }
      
      return {
        status,
        issues,
        metrics,
        flags: {
          emergencyStop: flags.EMERGENCY_STOP,
          maintenanceMode: flags.MAINTENANCE_MODE,
          readonlyMode: flags.READONLY_MODE
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting system health:', error);
      return {
        status: 'unknown',
        issues: ['Health check failed'],
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = LaunchControlService;