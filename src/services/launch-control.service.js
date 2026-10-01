/**
 * Launch Control Service
 * Manages real-time platform controls and risk management
 */

const { PrismaClient } = require('@prisma/client');
const { DEFAULT_LAUNCH_CONTROLS, LAUNCH_CONTROL_PRESETS } = require('../config/launch-control.config');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class LaunchControlService {
  constructor() {
    this.controls = { ...DEFAULT_LAUNCH_CONTROLS };
    this.loadControls();
  }

  async loadControls() {
    try {
      const settings = await prisma.launchControlSetting.findMany({
        where: { isActive: true }
      });
      
      settings.forEach(setting => {
        this.controls[setting.key] = this.parseValue(setting.value, setting.type);
      });
      
      logger.info('Launch controls loaded', { controlsCount: settings.length });
    } catch (error) {
      logger.error('Failed to load launch controls', { error: error.message });
      // Use defaults if database is not available
    }
  }

  async updateControl(key, value, adminId, reason = '') {
    try {
      const oldValue = this.controls[key];
      
      // Validate the control exists
      if (!(key in DEFAULT_LAUNCH_CONTROLS)) {
        throw new Error(`Invalid launch control key: ${key}`);
      }

      // Update in memory
      this.controls[key] = value;

      // Save to database
      await prisma.launchControlSetting.upsert({
        where: { key },
        update: {
          value: String(value),
          updatedBy: adminId,
          updatedAt: new Date()
        },
        create: {
          key,
          value: String(value),
          type: typeof value,
          createdBy: adminId,
          updatedBy: adminId
        }
      });

      // Log the change
      await prisma.launchControlAudit.create({
        data: {
          key,
          oldValue: String(oldValue),
          newValue: String(value),
          changedBy: adminId,
          reason,
          timestamp: new Date()
        }
      });

      logger.info('Launch control updated', {
        key,
        oldValue,
        newValue: value,
        adminId,
        reason
      });

      return { success: true, oldValue, newValue: value };
    } catch (error) {
      logger.error('Failed to update launch control', {
        key,
        value,
        error: error.message
      });
      throw error;
    }
  }

  async applyPreset(presetName, adminId, reason = '') {
    try {
      const preset = LAUNCH_CONTROL_PRESETS[presetName];
      if (!preset) {
        throw new Error(`Invalid preset: ${presetName}`);
      }

      const changes = [];
      for (const [key, value] of Object.entries(preset)) {
        const result = await this.updateControl(key, value, adminId, `Preset: ${presetName} - ${reason}`);
        changes.push({ key, ...result });
      }

      logger.info('Launch control preset applied', {
        presetName,
        adminId,
        changesCount: changes.length
      });

      return { success: true, preset: presetName, changes };
    } catch (error) {
      logger.error('Failed to apply preset', {
        presetName,
        error: error.message
      });
      throw error;
    }
  }

  getControl(key) {
    return this.controls[key];
  }

  getAllControls() {
    return { ...this.controls };
  }

  async getMetrics() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        dailyOrders,
        activeRetailers,
        activeVendors,
        concurrentOrders,
        totalCreditExposure
      ] = await Promise.all([
        prisma.order.count({
          where: {
            createdAt: { gte: today }
          }
        }),
        prisma.user.count({
          where: {
            role: 'RETAILER',
            isActive: true
          }
        }),
        prisma.user.count({
          where: {
            role: 'WHOLESALER',
            isActive: true
          }
        }),
        prisma.order.count({
          where: {
            status: { in: ['PENDING', 'CONFIRMED', 'PREPARING'] }
          }
        }),
        prisma.creditLedger.aggregate({
          _sum: { amount: true },
          where: {
            type: 'CREDIT',
            status: 'ACTIVE'
          }
        })
      ]);

      return {
        dailyOrders,
        activeRetailers,
        activeVendors,
        concurrentOrders,
        totalCreditExposure: totalCreditExposure._sum.amount || 0,
        limits: {
          maxDailyOrders: this.controls.MAX_DAILY_ORDERS,
          maxActiveRetailers: this.controls.MAX_ACTIVE_RETAILERS,
          maxActiveVendors: this.controls.MAX_ACTIVE_VENDORS,
          maxConcurrentOrders: this.controls.MAX_CONCURRENT_ORDERS
        }
      };
    } catch (error) {
      logger.error('Failed to get metrics', { error: error.message });
      throw error;
    }
  }

  async getAuditLog(limit = 50) {
    try {
      return await prisma.launchControlAudit.findMany({
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          changedByUser: {
            select: { name: true, email: true }
          }
        }
      });
    } catch (error) {
      logger.error('Failed to get audit log', { error: error.message });
      throw error;
    }
  }

  // Risk checks
  checkDailyOrderLimit() {
    return this.getMetrics().then(metrics => 
      metrics.dailyOrders < this.controls.MAX_DAILY_ORDERS
    );
  }

  checkConcurrentOrderLimit() {
    return this.getMetrics().then(metrics => 
      metrics.concurrentOrders < this.controls.MAX_CONCURRENT_ORDERS
    );
  }

  checkRetailerLimit() {
    return this.getMetrics().then(metrics => 
      metrics.activeRetailers < this.controls.MAX_ACTIVE_RETAILERS
    );
  }

  isEmergencyStop() {
    return this.controls.EMERGENCY_STOP;
  }

  isMaintenanceMode() {
    return this.controls.MAINTENANCE_MODE;
  }

  isReadOnlyMode() {
    return this.controls.READ_ONLY_MODE;
  }

  parseValue(value, type) {
    switch (type) {
      case 'boolean':
        return value === 'true';
      case 'number':
        return Number(value);
      default:
        return value;
    }
  }
}

module.exports = new LaunchControlService();