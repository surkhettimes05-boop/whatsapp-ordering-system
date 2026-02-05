// =============================================================================
// LAUNCH CONTROL CONFIGURATION
// Growth & Risk Engineering - Real-time Platform Controls
// =============================================================================

const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');
const logger = require('../infrastructure/logger');

class LaunchControlConfig {
  constructor() {
    this.prisma = new PrismaClient();
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.cacheKey = 'launch_control_flags';
    this.cacheTTL = 60; // 1 minute cache
    
    // Default launch control flags
    this.defaultFlags = {
      MAX_DAILY_ORDERS: parseInt(process.env.MAX_DAILY_ORDERS) || 100,
      MAX_CREDIT_PER_RETAILER: parseInt(process.env.MAX_CREDIT_PER_RETAILER) || 50000,
      MAX_ACTIVE_RETAILERS: parseInt(process.env.MAX_ACTIVE_RETAILERS) || 50,
      MAX_ACTIVE_VENDORS: parseInt(process.env.MAX_ACTIVE_VENDORS) || 20,
      ADMIN_APPROVAL_REQUIRED: process.env.ADMIN_APPROVAL_REQUIRED === 'true' || false,
      
      // Additional risk controls
      MAX_ORDER_VALUE: parseInt(process.env.MAX_ORDER_VALUE) || 100000,
      MAX_ORDERS_PER_RETAILER_DAILY: parseInt(process.env.MAX_ORDERS_PER_RETAILER_DAILY) || 10,
      MAX_CREDIT_UTILIZATION_PERCENT: parseInt(process.env.MAX_CREDIT_UTILIZATION_PERCENT) || 80,
      REQUIRE_PHONE_VERIFICATION: process.env.REQUIRE_PHONE_VERIFICATION === 'true' || true,
      ENABLE_FRAUD_DETECTION: process.env.ENABLE_FRAUD_DETECTION === 'true' || true,
      
      // Platform capacity controls
      MAX_CONCURRENT_ORDERS: parseInt(process.env.MAX_CONCURRENT_ORDERS) || 200,
      MAX_WEBHOOK_RATE_PER_MINUTE: parseInt(process.env.MAX_WEBHOOK_RATE_PER_MINUTE) || 1000,
      MAINTENANCE_MODE: process.env.MAINTENANCE_MODE === 'true' || false,
      
      // Feature flags
      ENABLE_NEW_RETAILER_SIGNUP: process.env.ENABLE_NEW_RETAILER_SIGNUP === 'true' || true,
      ENABLE_NEW_VENDOR_SIGNUP: process.env.ENABLE_NEW_VENDOR_SIGNUP === 'true' || true,
      ENABLE_CREDIT_SYSTEM: process.env.ENABLE_CREDIT_SYSTEM === 'true' || true,
      ENABLE_VENDOR_BIDDING: process.env.ENABLE_VENDOR_BIDDING === 'true' || true,
      
      // Emergency controls
      EMERGENCY_STOP: process.env.EMERGENCY_STOP === 'true' || false,
      READONLY_MODE: process.env.READONLY_MODE === 'true' || false,
      
      // Monitoring thresholds
      ALERT_ON_HIGH_ORDER_VOLUME: process.env.ALERT_ON_HIGH_ORDER_VOLUME === 'true' || true,
      HIGH_ORDER_VOLUME_THRESHOLD: parseInt(process.env.HIGH_ORDER_VOLUME_THRESHOLD) || 80,
      
      // Last updated metadata
      LAST_UPDATED: new Date().toISOString(),
      UPDATED_BY: 'system'
    };
  }

  // Get all launch control flags (cached)
  async getFlags() {
    try {
      // Try cache first
      const cached = await this.redis.get(this.cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get from database
      const dbFlags = await this.prisma.launchControlFlag.findMany();
      
      // Merge with defaults
      const flags = { ...this.defaultFlags };
      dbFlags.forEach(flag => {
        if (flag.valueType === 'boolean') {
          flags[flag.key] = flag.booleanValue;
        } else if (flag.valueType === 'integer') {
          flags[flag.key] = flag.integerValue;
        } else if (flag.valueType === 'string') {
          flags[flag.key] = flag.stringValue;
        }
        flags.LAST_UPDATED = flag.updatedAt.toISOString();
        flags.UPDATED_BY = flag.updatedBy || 'system';
      });

      // Cache for 1 minute
      await this.redis.setex(this.cacheKey, this.cacheTTL, JSON.stringify(flags));
      
      return flags;
    } catch (error) {
      logger.error('Error getting launch control flags:', error);
      return this.defaultFlags;
    }
  }

  // Get specific flag value
  async getFlag(key) {
    const flags = await this.getFlags();
    return flags[key] !== undefined ? flags[key] : this.defaultFlags[key];
  }

  // Update flag value
  async updateFlag(key, value, updatedBy = 'admin') {
    try {
      const valueType = typeof value === 'boolean' ? 'boolean' : 
                       typeof value === 'number' ? 'integer' : 'string';

      await this.prisma.launchControlFlag.upsert({
        where: { key },
        update: {
          booleanValue: valueType === 'boolean' ? value : null,
          integerValue: valueType === 'integer' ? value : null,
          stringValue: valueType === 'string' ? value : null,
          valueType,
          updatedBy,
          updatedAt: new Date()
        },
        create: {
          key,
          booleanValue: valueType === 'boolean' ? value : null,
          integerValue: valueType === 'integer' ? value : null,
          stringValue: valueType === 'string' ? value : null,
          valueType,
          updatedBy,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Clear cache
      await this.redis.del(this.cacheKey);
      
      // Log the change
      logger.info(`Launch control flag updated: ${key} = ${value} by ${updatedBy}`);
      
      // Trigger alerts if critical flags changed
      await this.checkCriticalFlagChanges(key, value, updatedBy);
      
      return true;
    } catch (error) {
      logger.error(`Error updating launch control flag ${key}:`, error);
      throw error;
    }
  }

  // Update multiple flags at once
  async updateFlags(flags, updatedBy = 'admin') {
    const results = [];
    for (const [key, value] of Object.entries(flags)) {
      try {
        await this.updateFlag(key, value, updatedBy);
        results.push({ key, success: true });
      } catch (error) {
        results.push({ key, success: false, error: error.message });
      }
    }
    return results;
  }

  // Check if operation is allowed based on current limits
  async checkLimit(limitType, currentValue, additionalValue = 1) {
    const flags = await this.getFlags();
    
    switch (limitType) {
      case 'DAILY_ORDERS':
        return (currentValue + additionalValue) <= flags.MAX_DAILY_ORDERS;
      
      case 'RETAILER_CREDIT':
        return (currentValue + additionalValue) <= flags.MAX_CREDIT_PER_RETAILER;
      
      case 'ACTIVE_RETAILERS':
        return currentValue < flags.MAX_ACTIVE_RETAILERS;
      
      case 'ACTIVE_VENDORS':
        return currentValue < flags.MAX_ACTIVE_VENDORS;
      
      case 'ORDER_VALUE':
        return additionalValue <= flags.MAX_ORDER_VALUE;
      
      case 'RETAILER_DAILY_ORDERS':
        return (currentValue + additionalValue) <= flags.MAX_ORDERS_PER_RETAILER_DAILY;
      
      case 'CONCURRENT_ORDERS':
        return currentValue < flags.MAX_CONCURRENT_ORDERS;
      
      default:
        return true;
    }
  }

  // Get current system metrics for dashboard
  async getSystemMetrics() {
    try {
      const [
        dailyOrders,
        activeRetailers,
        activeVendors,
        concurrentOrders,
        totalCreditExposure
      ] = await Promise.all([
        this.getDailyOrderCount(),
        this.getActiveRetailerCount(),
        this.getActiveVendorCount(),
        this.getConcurrentOrderCount(),
        this.getTotalCreditExposure()
      ]);

      const flags = await this.getFlags();

      return {
        dailyOrders: {
          current: dailyOrders,
          limit: flags.MAX_DAILY_ORDERS,
          utilization: Math.round((dailyOrders / flags.MAX_DAILY_ORDERS) * 100)
        },
        activeRetailers: {
          current: activeRetailers,
          limit: flags.MAX_ACTIVE_RETAILERS,
          utilization: Math.round((activeRetailers / flags.MAX_ACTIVE_RETAILERS) * 100)
        },
        activeVendors: {
          current: activeVendors,
          limit: flags.MAX_ACTIVE_VENDORS,
          utilization: Math.round((activeVendors / flags.MAX_ACTIVE_VENDORS) * 100)
        },
        concurrentOrders: {
          current: concurrentOrders,
          limit: flags.MAX_CONCURRENT_ORDERS,
          utilization: Math.round((concurrentOrders / flags.MAX_CONCURRENT_ORDERS) * 100)
        },
        creditExposure: {
          current: totalCreditExposure,
          limit: flags.MAX_CREDIT_PER_RETAILER * flags.MAX_ACTIVE_RETAILERS,
          utilization: Math.round((totalCreditExposure / (flags.MAX_CREDIT_PER_RETAILER * flags.MAX_ACTIVE_RETAILERS)) * 100)
        }
      };
    } catch (error) {
      logger.error('Error getting system metrics:', error);
      return null;
    }
  }

  // Helper methods for metrics
  async getDailyOrderCount() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return await this.prisma.order.count({
      where: {
        createdAt: {
          gte: today
        }
      }
    });
  }

  async getActiveRetailerCount() {
    return await this.prisma.retailer.count({
      where: {
        status: 'ACTIVE'
      }
    });
  }

  async getActiveVendorCount() {
    return await this.prisma.wholesaler.count({
      where: {
        status: 'ACTIVE'
      }
    });
  }

  async getConcurrentOrderCount() {
    return await this.prisma.order.count({
      where: {
        status: {
          in: ['CREATED', 'PENDING_BIDS', 'CREDIT_APPROVED', 'STOCK_RESERVED', 'WHOLESALER_ACCEPTED']
        }
      }
    });
  }

  async getTotalCreditExposure() {
    const result = await this.prisma.creditAccount.aggregate({
      _sum: {
        usedCredit: true
      },
      where: {
        retailer: {
          status: 'ACTIVE'
        }
      }
    });
    
    return result._sum.usedCredit || 0;
  }

  // Check for critical flag changes and send alerts
  async checkCriticalFlagChanges(key, value, updatedBy) {
    const criticalFlags = [
      'EMERGENCY_STOP',
      'MAINTENANCE_MODE',
      'READONLY_MODE',
      'MAX_DAILY_ORDERS',
      'MAX_ACTIVE_RETAILERS'
    ];

    if (criticalFlags.includes(key)) {
      logger.warn(`CRITICAL FLAG CHANGE: ${key} set to ${value} by ${updatedBy}`);
      
      // Here you could integrate with alerting systems
      // await this.sendAlert(`Critical launch control flag changed: ${key} = ${value}`);
    }
  }

  // Emergency stop - disable all new operations
  async emergencyStop(reason, updatedBy = 'admin') {
    logger.error(`EMERGENCY STOP ACTIVATED: ${reason} by ${updatedBy}`);
    
    await this.updateFlags({
      EMERGENCY_STOP: true,
      READONLY_MODE: true,
      ENABLE_NEW_RETAILER_SIGNUP: false,
      ENABLE_NEW_VENDOR_SIGNUP: false,
      MAINTENANCE_MODE: true
    }, updatedBy);

    return true;
  }

  // Resume normal operations
  async resumeOperations(updatedBy = 'admin') {
    logger.info(`Operations resumed by ${updatedBy}`);
    
    await this.updateFlags({
      EMERGENCY_STOP: false,
      READONLY_MODE: false,
      MAINTENANCE_MODE: false,
      ENABLE_NEW_RETAILER_SIGNUP: true,
      ENABLE_NEW_VENDOR_SIGNUP: true
    }, updatedBy);

    return true;
  }
}

module.exports = LaunchControlConfig;