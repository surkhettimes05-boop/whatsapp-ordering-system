const orderService = require('../services/order.service');
const broadcastService = require('../services/broadcast.service');
const { validationResult } = require('express-validator');

class OrderController {
  /**
   * Create order
   */
  async createOrder(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const order = await orderService.createOrder(req.user.id, req.body);

      // Broadcast the order to eligible wholesalers
      await broadcastService.broadcastOrder(order.id);

      res.status(201).json({
        success: true,
        message: 'Order created and broadcasted successfully',
        data: { order }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get user's orders
   */
  async getUserOrders(req, res) {
    try {
      const result = await orderService.getUserOrders(req.user.id, req.query);

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
   * Get order by ID
   */
  async getOrder(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.role === 'ADMIN' ? null : req.user.id;
      const order = await orderService.getOrderById(id, userId);

      res.json({
        success: true,
        data: { order }
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get all orders (Admin)
   */
  async getAllOrders(req, res) {
    try {
      const result = await orderService.getAllOrders(req.query);

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
   * Update order status (with state machine validation)
   */
  async updateOrderStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;
      const performedBy = req.user?.id || 'SYSTEM'; // Get from auth middleware

      if (!status) {
        return res.status(400).json({
          success: false,
          error: 'Status is required'
        });
      }

      // State machine validation happens in service
      const order = await orderService.updateOrderStatus(id, status, performedBy, reason);

      res.json({
        success: true,
        message: 'Order status updated',
        data: { order }
      });
    } catch (error) {
      // Check if it's a state machine validation error
      if (error.message.includes('Invalid transition') || error.message.includes('terminal state')) {
        return res.status(400).json({
          success: false,
          error: error.message,
          type: 'STATE_MACHINE_VALIDATION_ERROR'
        });
      }

      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(req, res) {
    try {
      const { id } = req.params;
      const order = await orderService.cancelOrder(id, req.user.id);

      res.json({
        success: true,
        message: 'Order cancelled',
        data: { order }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new OrderController();
