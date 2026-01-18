const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const orderInventoryController = require('../controllers/order-inventory.controller');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');

/**
 * INVENTORY MANAGEMENT ROUTES
 * Handles stock checking, reservation, and auditing
 */

// ============================================
// PUBLIC INVENTORY CHECKS
// ============================================

/**
 * Check availability before ordering
 * POST /api/v1/inventory/check
 */
router.post(
  '/check',
  [
    body('wholesalerId').notEmpty().withMessage('wholesalerId required'),
    body('items').isArray().notEmpty().withMessage('items must be non-empty array'),
    body('items.*.productId').notEmpty(),
    body('items.*.quantity').isInt({ min: 1 })
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
  orderInventoryController.checkAvailability
);

/**
 * Get inventory status for a product
 * GET /api/v1/inventory/:wholesalerId/:productId
 */
router.get(
  '/:wholesalerId/:productId',
  [
    param('wholesalerId').notEmpty().withMessage('wholesalerId required'),
    param('productId').notEmpty().withMessage('productId required')
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
  orderInventoryController.getInventoryStatus
);

// ============================================
// ADMIN INVENTORY AUDITING
// ============================================

/**
 * Get inventory audit trail
 * GET /api/v1/inventory/:wholesalerId/:productId/audit
 * Admin only - for debugging and compliance
 */
router.get(
  '/:wholesalerId/:productId/audit',
  authenticate,
  isAdmin,
  orderInventoryController.getInventoryAudit
);

/**
 * Detect and report inventory issues
 * GET /api/v1/inventory/diagnose/negative-stock
 * Admin only - emergency diagnosis
 */
router.get(
  '/diagnose/negative-stock',
  authenticate,
  isAdmin,
  orderInventoryController.detectNegativeStock
);

module.exports = router;
