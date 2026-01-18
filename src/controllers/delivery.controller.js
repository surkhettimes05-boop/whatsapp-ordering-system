const deliveryService = require('../services/delivery.service');
const { validationResult } = require('express-validator');

class DeliveryController {
  /**
   * Create delivery for order
   */
  async createDelivery(req, res) {
    try {
      const { orderId } = req.params;
      const delivery = await deliveryService.createDelivery(orderId, req.body);

      res.status(201).json({
        success: true,
        message: 'Delivery created',
        data: { delivery }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get delivery by tracking number
   */
  async getDeliveryByTracking(req, res) {
    try {
      const { trackingNumber } = req.params;
      const delivery = await deliveryService.getDeliveryByTracking(trackingNumber);

      res.json({
        success: true,
        data: { delivery }
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get delivery by order ID
   */
  async getDeliveryByOrder(req, res) {
    try {
      const { orderId } = req.params;
      const delivery = await deliveryService.getDeliveryByOrder(orderId);

      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: 'Delivery not found for this order'
        });
      }

      res.json({
        success: true,
        data: { delivery }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update delivery status
   */
  async updateDeliveryStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, notes, location, latitude, longitude, agentName, agentPhone, vehicleNumber } = req.body;

      const updateData = {
        notes,
        location,
        latitude,
        longitude,
        updatedBy: req.user?.id || 'SYSTEM'
      };

      if (agentName) {
        updateData.agentName = agentName;
        updateData.agentPhone = agentPhone;
        updateData.vehicleNumber = vehicleNumber;
      }

      const delivery = await deliveryService.updateDeliveryStatus(id, status, updateData);

      res.json({
        success: true,
        message: 'Delivery status updated',
        data: { delivery }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get all deliveries
   */
  async getAllDeliveries(req, res) {
    try {
      const result = await deliveryService.getAllDeliveries(req.query);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update delivery location
   */
  async updateLocation(req, res) {
    try {
      const { id } = req.params;
      const { location, latitude, longitude } = req.body;

      const delivery = await deliveryService.updateLocation(id, {
        location,
        latitude,
        longitude,
        updatedBy: req.user?.id || 'SYSTEM'
      });

      res.json({
        success: true,
        message: 'Location updated',
        data: { delivery }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Assign delivery agent
   */
  async assignAgent(req, res) {
    try {
      const { id } = req.params;
      const { name, phone, vehicleNumber } = req.body;

      const delivery = await deliveryService.assignAgent(id, {
        name,
        phone,
        vehicleNumber,
        updatedBy: req.user?.id || 'SYSTEM'
      });

      res.json({
        success: true,
        message: 'Agent assigned',
        data: { delivery }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new DeliveryController();

