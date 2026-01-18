const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const orderInventoryController = require('../controllers/order-inventory.controller');
const { authenticate } = require('../middleware/auth.middleware');

/**
 * ORDER WITH INVENTORY ROUTES
 * Enhanced order endpoints with stock management
 */

// All endpoints require authentication
router.use(authenticate);

// ============================================
// ORDER CREATION WITH INVENTORY
// ============================================

/**
 * Create order with automatic stock reservation
 * POST /api/v1/orders/with-inventory
 * 
 * Body: {
 *   wholesalerId: string,
 *   items: [{ productId: string, quantity: number }, ...],
 *   paymentMode: "COD" | "CREDIT" (default: COD)
 * }
 * 
 * Returns: Order with reserved stock
 */
router.post(
  '/with-inventory',
  [
    body('wholesalerId').notEmpty().withMessage('wholesalerId required'),
    body('items').isArray().notEmpty().withMessage('items must be non-empty array'),
    body('items.*.productId').notEmpty().withMessage('productId required for each item'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('quantity must be positive integer'),
    body('paymentMode')
      .optional()
      .isIn(['COD', 'CREDIT'])
      .withMessage('paymentMode must be COD or CREDIT')
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
  orderInventoryController.createOrderWithInventory
);

// ============================================
// ORDER LIFECYCLE MANAGEMENT
// ============================================

/**
 * Confirm order (wholesaler accepts)
 * POST /api/v1/orders/:id/confirm
 * 
 * Transitions order from PLACED → CONFIRMED
 * Stock remains reserved
 */
router.post(
  '/:id/confirm',
  [param('id').notEmpty().withMessage('Order ID required')],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
  orderInventoryController.confirmOrder
);

/**
 * Cancel order and release reserved stock
 * POST /api/v1/orders/:id/cancel
 * 
 * Body: { reason?: string }
 * 
 * Transitions order to CANCELLED
 * Releases all reserved stock immediately
 */
router.post(
  '/:id/cancel',
  [
    param('id').notEmpty().withMessage('Order ID required'),
    body('reason').optional().isString()
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
  orderInventoryController.cancelOrder
);

/**
 * Deliver order and deduct final stock
 * POST /api/v1/orders/:id/deliver
 * 
 * Body: {
 *   partialQuantities?: {
 *     reservationId: quantity  // For partial fulfillment
 *   }
 * }
 * 
 * Transitions order to DELIVERED
 * Deducts stock from physical inventory
 * Supports partial fulfillment
 */
router.post(
  '/:id/deliver',
  [param('id').notEmpty().withMessage('Order ID required')],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
  orderInventoryController.completeOrder
);

// ============================================
// ORDER INQUIRY WITH INVENTORY
// ============================================

/**
 * Get order with inventory details
 * GET /api/v1/orders/:id/inventory
 * 
 * Returns order data plus:
 * - Reserved stock status per item
 * - Fulfilled items count
 * - Released items count
 */
router.get(
  '/:id/inventory',
  [param('id').notEmpty().withMessage('Order ID required')],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
  orderInventoryController.getOrderWithInventory
);

module.exports = router;
