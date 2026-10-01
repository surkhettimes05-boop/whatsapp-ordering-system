/**
 * Launch Control Controller
 * API endpoints for managing platform controls
 */

const launchControlService = require('../services/launch-control.service');
const { LAUNCH_CONTROL_PRESETS } = require('../config/launch-control.config');
const logger = require('../utils/logger');

class LaunchControlController {
  async getControls(req, res) {
    try {
      const controls = launchControlService.getAllControls();
      res.json({
        success: true,
        data: controls
      });
    } catch (error) {
      logger.error('Failed to get launch controls', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get launch controls'
      });
    }
  }

  async updateControl(req, res) {
    try {
      const { key, value, reason } = req.body;
      const adminId = req.user.id;

      if (!key || value === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Key and value are required'
        });
      }

      const result = await launchControlService.updateControl(key, value, adminId, reason);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to update launch control', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async applyPreset(req, res) {
    try {
      const { preset, reason } = req.body;
      const adminId = req.user.id;

      if (!preset) {
        return res.status(400).json({
          success: false,
          error: 'Preset name is required'
        });
      }

      const result = await launchControlService.applyPreset(preset, adminId, reason);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to apply preset', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getPresets(req, res) {
    try {
      res.json({
        success: true,
        data: LAUNCH_CONTROL_PRESETS
      });
    } catch (error) {
      logger.error('Failed to get presets', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get presets'
      });
    }
  }

  async getMetrics(req, res) {
    try {
      const metrics = await launchControlService.getMetrics();
      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Failed to get metrics', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get metrics'
      });
    }
  }

  async getAuditLog(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const auditLog = await launchControlService.getAuditLog(limit);
      
      res.json({
        success: true,
        data: auditLog
      });
    } catch (error) {
      logger.error('Failed to get audit log', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get audit log'
      });
    }
  }

  async emergencyStop(req, res) {
    try {
      const { reason } = req.body;
      const adminId = req.user.id;

      await launchControlService.updateControl('EMERGENCY_STOP', true, adminId, reason || 'Emergency stop activated');
      
      logger.warn('Emergency stop activated', { adminId, reason });
      
      res.json({
        success: true,
        message: 'Emergency stop activated'
      });
    } catch (error) {
      logger.error('Failed to activate emergency stop', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to activate emergency stop'
      });
    }
  }

  async resumeOperations(req, res) {
    try {
      const { reason } = req.body;
      const adminId = req.user.id;

      await launchControlService.updateControl('EMERGENCY_STOP', false, adminId, reason || 'Operations resumed');
      
      logger.info('Operations resumed', { adminId, reason });
      
      res.json({
        success: true,
        message: 'Operations resumed'
      });
    } catch (error) {
      logger.error('Failed to resume operations', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to resume operations'
      });
    }
  }
}

module.exports = new LaunchControlController();