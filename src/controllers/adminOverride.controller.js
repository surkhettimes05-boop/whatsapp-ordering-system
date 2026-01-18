const express = require('express');
const router = express.Router();
const adminService = require('../services/admin.service');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');
const { body, validationResult } = require('express-validator');

/**
 * @route POST /api/v1/admin/overrides/credit-limit
 * @description Manually override a retailer's credit limit. Admin only.
 * @access Admin
 */
router.post(
  '/credit-limit',
  [
    body('retailerId').notEmpty().withMessage('Retailer ID is required'),
    body('newCreditLimit').isNumeric().withMessage('New credit limit must be a number'),
    body('reason').notEmpty().withMessage('Reason for override is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { retailerId, newCreditLimit, reason } = req.body;
    const adminId = req.user.id; // Assuming req.user is populated by auth middleware

    try {
      const updatedCreditAccount = await adminService.overrideCreditLimit(
        adminId,
        retailerId,
        parseFloat(newCreditLimit),
        reason
      );
      res.status(200).json({
        success: true,
        message: 'Credit limit overridden successfully',
        data: updatedCreditAccount,
      });
    } catch (error) {
      console.error('Error overriding credit limit:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route POST /api/v1/admin/overrides/cancel-order
 * @description Manually force cancel an order. Admin only.
 * @access Admin
 */
router.post(
  '/cancel-order',
  [
    body('orderId').notEmpty().withMessage('Order ID is required'),
    body('reason').notEmpty().withMessage('Reason for cancellation is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId, reason } = req.body;
    const adminId = req.user?.id || 'admin'; // Assuming req.user is populated by auth middleware

    try {
      const cancelledOrder = await adminService.forceCancelOrder(adminId, orderId, reason);
      res.status(200).json({
        success: true,
        message: 'Order forcefully cancelled successfully',
        data: cancelledOrder,
      });
    } catch (error) {
      console.error('Error forcefully cancelling order:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route POST /api/v1/admin/overrides/force-select-vendor
 * @description Force select a vendor for an order. Admin only.
 * @access Admin
 */
router.post(
  '/force-select-vendor',
  [
    body('orderId').notEmpty().withMessage('Order ID is required'),
    body('wholesalerId').notEmpty().withMessage('Wholesaler ID is required'),
    body('reason').notEmpty().withMessage('Reason for override is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId, wholesalerId, reason } = req.body;
    const adminId = req.user?.id || 'admin';

    try {
      const updatedOrder = await adminService.forceSelectVendor(adminId, orderId, wholesalerId, reason);
      res.status(200).json({
        success: true,
        message: 'Vendor force selected successfully',
        data: updatedOrder,
      });
    } catch (error) {
      console.error('Error force selecting vendor:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route POST /api/v1/admin/overrides/extend-expiry
 * @description Extend order expiry time. Admin only.
 * @access Admin
 */
router.post(
  '/extend-expiry',
  [
    body('orderId').notEmpty().withMessage('Order ID is required'),
    body('additionalMinutes').isNumeric().withMessage('Additional minutes must be a number'),
    body('reason').notEmpty().withMessage('Reason for extension is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId, additionalMinutes, reason } = req.body;
    const adminId = req.user?.id || 'admin';

    try {
      const updatedOrder = await adminService.extendOrderExpiry(
        adminId,
        orderId,
        parseInt(additionalMinutes),
        reason
      );
      res.status(200).json({
        success: true,
        message: 'Order expiry extended successfully',
        data: updatedOrder,
      });
    } catch (error) {
      console.error('Error extending order expiry:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

module.exports = router;