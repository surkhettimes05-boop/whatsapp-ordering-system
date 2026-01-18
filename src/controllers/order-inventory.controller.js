const orderServiceV2 = require('../services/order.service.v2');
const inventoryService = require('../services/inventory.service');
const { validationResult } = require('express-validator');

/**
 * Order Controller with Inventory Integration
 * Handles order creation, cancellation, and delivery with stock management
 */
class OrderInventoryController {
  /**
   * Create order with stock reservation
   * 
   * POST /api/v1/orders/with-inventory
   * Body: {
   *   wholesalerId: string,
   *   items: [{ productId, quantity }, ...],
   *   paymentMode: "COD" | "CREDIT"
   * }
   */
  async createOrderWithInventory(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { wholesalerId, items, paymentMode } = req.body;
      const retailerId = req.user.id;

      // Create order with inventory
      const result = await orderServiceV2.createOrderWithInventory(
        retailerId,
        wholesalerId,
        items,
        { paymentMode }
      );

      return res.status(201).json({
        success: true,
        message: 'Order created and stock reserved',
        data: result
      });
    } catch (error) {
      console.error('Order creation error:', error);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Cancel order and release stock
   * 
   * POST /api/v1/orders/:id/cancel
   * Body: { reason?: string }
   */
  async cancelOrder(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const result = await orderServiceV2.cancelOrder(id, reason);

      return res.json({
        success: true,
        message: 'Order cancelled and stock released',
        data: result
      });
    } catch (error) {
      console.error('Order cancellation error:', error);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Confirm order (wholesaler accepts)
   * 
   * POST /api/v1/orders/:id/confirm
   */
  async confirmOrder(req, res) {
    try {
      const { id } = req.params;

      const result = await orderServiceV2.confirmOrder(id);

      return res.json({
        success: true,
        message: 'Order confirmed by wholesaler',
        data: result
      });
    } catch (error) {
      console.error('Order confirmation error:', error);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Complete/Deliver order and deduct stock
   * 
   * POST /api/v1/orders/:id/deliver
   * Body: { partialQuantities?: {reservationId: quantity} }
   */
  async completeOrder(req, res) {
    try {
      const { id } = req.params;
      const { partialQuantities } = req.body;

      const result = await orderServiceV2.completeOrder(id, { partialQuantities });

      return res.json({
        success: true,
        message: 'Order delivered and stock deducted',
        data: result
      });
    } catch (error) {
      console.error('Order completion error:', error);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get order with inventory details
   * 
   * GET /api/v1/orders/:id/inventory
   */
  async getOrderWithInventory(req, res) {
    try {
      const { id } = req.params;

      const result = await orderServiceV2.getOrderWithInventory(id);

      return res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get order error:', error);
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Check inventory availability before order
   * 
   * POST /api/v1/inventory/check-availability
   * Body: { wholesalerId, items: [{productId, quantity}, ...] }
   */
  async checkAvailability(req, res) {
    try {
      const { wholesalerId, items } = req.body;

      if (!wholesalerId || !items || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'wholesalerId and items are required'
        });
      }

      const validation = await inventoryService.validateOrderAvailability(wholesalerId, items);

      return res.json({
        success: true,
        data: {
          canFulfill: validation.canFulfill,
          shortages: validation.shortages,
          errors: validation.errors,
          message: validation.canFulfill 
            ? 'All items available'
            : validation.shortages.length > 0
            ? `Insufficient stock: ${validation.shortages.map(s => `${s.productName} (need ${s.shortage} more)`).join(', ')}`
            : validation.errors[0] || 'Cannot fulfill order'
        }
      });
    } catch (error) {
      console.error('Availability check error:', error);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get inventory status for a product
   * 
   * GET /api/v1/inventory/:wholesalerId/:productId
   */
  async getInventoryStatus(req, res) {
    try {
      const { wholesalerId, productId } = req.params;

      const status = await inventoryService.getInventoryStatus(wholesalerId, productId);

      return res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Get inventory status error:', error);
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get inventory audit trail for a product
   * (Admin only - for debugging/auditing)
   * 
   * GET /api/v1/inventory/:wholesalerId/:productId/audit
   */
  async getInventoryAudit(req, res) {
    try {
      const { wholesalerId, productId } = req.params;

      const audit = await inventoryService.getInventoryAudit(wholesalerId, productId);

      return res.json({
        success: true,
        data: audit
      });
    } catch (error) {
      console.error('Get inventory audit error:', error);
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Detect negative stock issues (Admin only - for emergency diagnosis)
   * 
   * GET /api/v1/inventory/diagnose/negative-stock
   */
  async detectNegativeStock(req, res) {
    try {
      const issues = await inventoryService.detectNegativeStock();

      return res.json({
        success: true,
        data: {
          issueCount: issues.length,
          issues,
          message: issues.length === 0 
            ? '✅ No inventory issues detected'
            : `⚠️ Found ${issues.length} inventory issues`
        }
      });
    } catch (error) {
      console.error('Inventory diagnosis error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new OrderInventoryController();
