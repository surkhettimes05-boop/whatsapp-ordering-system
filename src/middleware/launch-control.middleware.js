// =============================================================================
// LAUNCH CONTROL MIDDLEWARE
// Growth & Risk Engineering - Request Validation & Limits
// =============================================================================

const LaunchControlConfig = require('../config/launch-control.config');
const logger = require('../infrastructure/logger');

class LaunchControlMiddleware {
  constructor() {
    this.launchControl = new LaunchControlConfig();
  }

  // Check if system is in emergency stop mode
  emergencyStopCheck() {
    return async (req, res, next) => {
      try {
        const emergencyStop = await this.launchControl.getFlag('EMERGENCY_STOP');
        const maintenanceMode = await this.launchControl.getFlag('MAINTENANCE_MODE');
        
        if (emergencyStop || maintenanceMode) {
          return res.status(503).json({
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            message: emergencyStop ? 
              'System is in emergency stop mode. All operations are temporarily disabled.' :
              'System is under maintenance. Please try again later.',
            retryAfter: 300 // 5 minutes
          });
        }
        
        next();
      } catch (error) {
        logger.error('Emergency stop check failed:', error);
        next(); // Continue on error to avoid blocking
      }
    };
  }

  // Check if system is in readonly mode
  readonlyModeCheck() {
    return async (req, res, next) => {
      try {
        const readonlyMode = await this.launchControl.getFlag('READONLY_MODE');
        
        if (readonlyMode && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
          return res.status(423).json({
            success: false,
            error: 'READONLY_MODE',
            message: 'System is in read-only mode. Write operations are temporarily disabled.',
            allowedMethods: ['GET', 'HEAD', 'OPTIONS']
          });
        }
        
        next();
      } catch (error) {
        logger.error('Readonly mode check failed:', error);
        next();
      }
    };
  }

  // Check daily order limits
  dailyOrderLimitCheck() {
    return async (req, res, next) => {
      try {
        if (req.method !== 'POST' || !req.path.includes('/orders')) {
          return next();
        }

        const dailyOrders = await this.launchControl.getDailyOrderCount();
        const maxDailyOrders = await this.launchControl.getFlag('MAX_DAILY_ORDERS');
        
        if (dailyOrders >= maxDailyOrders) {
          logger.warn(`Daily order limit reached: ${dailyOrders}/${maxDailyOrders}`);
          
          return res.status(429).json({
            success: false,
            error: 'DAILY_LIMIT_EXCEEDED',
            message: 'Daily order limit has been reached. Please try again tomorrow.',
            limits: {
              current: dailyOrders,
              maximum: maxDailyOrders,
              resetTime: this.getNextMidnight()
            }
          });
        }
        
        next();
      } catch (error) {
        logger.error('Daily order limit check failed:', error);
        next();
      }
    };
  }

  // Check retailer limits
  retailerLimitCheck() {
    return async (req, res, next) => {
      try {
        if (req.method !== 'POST' || !req.path.includes('/retailers')) {
          return next();
        }

        const activeRetailers = await this.launchControl.getActiveRetailerCount();
        const maxActiveRetailers = await this.launchControl.getFlag('MAX_ACTIVE_RETAILERS');
        
        if (activeRetailers >= maxActiveRetailers) {
          logger.warn(`Active retailer limit reached: ${activeRetailers}/${maxActiveRetailers}`);
          
          return res.status(429).json({
            success: false,
            error: 'RETAILER_LIMIT_EXCEEDED',
            message: 'Maximum number of active retailers reached. New registrations are temporarily disabled.',
            limits: {
              current: activeRetailers,
              maximum: maxActiveRetailers
            }
          });
        }
        
        next();
      } catch (error) {
        logger.error('Retailer limit check failed:', error);
        next();
      }
    };
  }

  // Check vendor limits
  vendorLimitCheck() {
    return async (req, res, next) => {
      try {
        if (req.method !== 'POST' || !req.path.includes('/vendors') && !req.path.includes('/wholesalers')) {
          return next();
        }

        const activeVendors = await this.launchControl.getActiveVendorCount();
        const maxActiveVendors = await this.launchControl.getFlag('MAX_ACTIVE_VENDORS');
        
        if (activeVendors >= maxActiveVendors) {
          logger.warn(`Active vendor limit reached: ${activeVendors}/${maxActiveVendors}`);
          
          return res.status(429).json({
            success: false,
            error: 'VENDOR_LIMIT_EXCEEDED',
            message: 'Maximum number of active vendors reached. New registrations are temporarily disabled.',
            limits: {
              current: activeVendors,
              maximum: maxActiveVendors
            }
          });
        }
        
        next();
      } catch (error) {
        logger.error('Vendor limit check failed:', error);
        next();
      }
    };
  }

  // Check credit limits
  creditLimitCheck() {
    return async (req, res, next) => {
      try {
        if (!req.body || !req.body.creditAmount) {
          return next();
        }

        const maxCreditPerRetailer = await this.launchControl.getFlag('MAX_CREDIT_PER_RETAILER');
        const requestedCredit = parseFloat(req.body.creditAmount);
        
        if (requestedCredit > maxCreditPerRetailer) {
          return res.status(400).json({
            success: false,
            error: 'CREDIT_LIMIT_EXCEEDED',
            message: `Credit amount exceeds maximum allowed limit of ${maxCreditPerRetailer}`,
            limits: {
              requested: requestedCredit,
              maximum: maxCreditPerRetailer
            }
          });
        }
        
        next();
      } catch (error) {
        logger.error('Credit limit check failed:', error);
        next();
      }
    };
  }

  // Check if admin approval is required
  adminApprovalCheck() {
    return async (req, res, next) => {
      try {
        const adminApprovalRequired = await this.launchControl.getFlag('ADMIN_APPROVAL_REQUIRED');
        
        if (adminApprovalRequired && req.method === 'POST') {
          // Add approval requirement to request
          req.requiresAdminApproval = true;
          
          // You could also modify the response to indicate pending approval
          const originalSend = res.send;
          res.send = function(data) {
            if (typeof data === 'object' && data.success) {
              data.status = 'PENDING_APPROVAL';
              data.message = 'Request submitted successfully. Awaiting admin approval.';
            }
            originalSend.call(this, data);
          };
        }
        
        next();
      } catch (error) {
        logger.error('Admin approval check failed:', error);
        next();
      }
    };
  }

  // Feature flag check
  featureFlagCheck(featureName) {
    return async (req, res, next) => {
      try {
        const featureEnabled = await this.launchControl.getFlag(featureName);
        
        if (!featureEnabled) {
          return res.status(404).json({
            success: false,
            error: 'FEATURE_DISABLED',
            message: `Feature '${featureName}' is currently disabled.`,
            feature: featureName
          });
        }
        
        next();
      } catch (error) {
        logger.error(`Feature flag check failed for ${featureName}:`, error);
        next();
      }
    };
  }

  // Order value limit check
  orderValueLimitCheck() {
    return async (req, res, next) => {
      try {
        if (!req.body || !req.body.totalAmount) {
          return next();
        }

        const maxOrderValue = await this.launchControl.getFlag('MAX_ORDER_VALUE');
        const orderValue = parseFloat(req.body.totalAmount);
        
        if (orderValue > maxOrderValue) {
          return res.status(400).json({
            success: false,
            error: 'ORDER_VALUE_EXCEEDED',
            message: `Order value exceeds maximum allowed limit of ${maxOrderValue}`,
            limits: {
              orderValue: orderValue,
              maximum: maxOrderValue
            }
          });
        }
        
        next();
      } catch (error) {
        logger.error('Order value limit check failed:', error);
        next();
      }
    };
  }

  // Rate limiting based on launch control flags
  dynamicRateLimit() {
    return async (req, res, next) => {
      try {
        const maxWebhookRate = await this.launchControl.getFlag('MAX_WEBHOOK_RATE_PER_MINUTE');
        
        // Implement rate limiting logic here
        // This is a simplified version - you'd want to use a proper rate limiter
        const key = `rate_limit:${req.ip}:${Math.floor(Date.now() / 60000)}`;
        const current = await this.launchControl.redis.incr(key);
        
        if (current === 1) {
          await this.launchControl.redis.expire(key, 60);
        }
        
        if (current > maxWebhookRate) {
          return res.status(429).json({
            success: false,
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
            retryAfter: 60
          });
        }
        
        next();
      } catch (error) {
        logger.error('Dynamic rate limit check failed:', error);
        next();
      }
    };
  }

  // Utility method to get next midnight
  getNextMidnight() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }
}

module.exports = LaunchControlMiddleware;