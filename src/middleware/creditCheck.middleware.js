/**
 * Credit Check Middleware
 * Validates credit limits before order placement/confirmation
 * 
 * USE IN: Order creation and confirmation endpoints
 * BLOCKS: Orders that would exceed credit limits
 * 
 * BUSINESS FLOW:
 * 1. Order is placed by retailer via WhatsApp
 * 2. Middleware checks if order can be placed
 * 3. If credit check fails, order is blocked
 * 4. If credit check passes, order proceeds
 */

const creditCheckService = require('../services/creditCheck.service');

/**
 * Middleware to check credit before allowing order placement
 * 
 * Expects req.body to have:
 * - retailerId
 * - wholesalerId
 * - totalAmount
 */
const checkCreditBeforeOrder = async (req, res, next) => {
  try {
    const { retailerId, wholesalerId, totalAmount } = req.body;

    if (!retailerId || !wholesalerId || !totalAmount) {
      return res.status(400).json({
        error: 'Missing required fields: retailerId, wholesalerId, totalAmount',
      });
    }

    // Run credit check
    const creditCheck = await creditCheckService.canPlaceOrder(
      retailerId,
      wholesalerId,
      Number(totalAmount)
    );

    // Attach result to request for use in controller
    req.creditCheck = creditCheck;

    if (!creditCheck.canPlace) {
      // Block the order
      return res.status(403).json({
        error: 'Order blocked due to credit limit',
        details: creditCheck,
      });
    }

    // Credit check passed, proceed
    next();

  } catch (error) {
    console.error('Credit check middleware error:', error);
    res.status(500).json({
      error: 'Credit check failed',
      message: error.message,
    });
  }
};

/**
 * Middleware for admin operations on credit
 * Requires admin authentication and valid reason
 */
const requireCreditAdmin = async (req, res, next) => {
  try {
    // TODO: Integrate with your auth middleware
    const user = req.user; // Assume auth middleware sets this

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Admin access required',
      });
    }

    next();

  } catch (error) {
    console.error('Admin check middleware error:', error);
    res.status(500).json({
      error: 'Authorization check failed',
    });
  }
};

/**
 * Middleware to validate credit configuration changes
 * Ensures credit limits are reasonable
 */
const validateCreditConfig = async (req, res, next) => {
  try {
    const { creditLimit, creditTerms } = req.body;

    const errors = [];

    if (creditLimit !== undefined) {
      const limit = Number(creditLimit);
      if (limit < 0) {
        errors.push('Credit limit cannot be negative');
      }
      if (limit > 10000000) {
        errors.push('Credit limit seems unreasonably high (>1 crore)');
      }
    }

    if (creditTerms !== undefined) {
      const terms = Number(creditTerms);
      if (terms < 0 || terms > 180) {
        errors.push('Credit terms should be between 0-180 days');
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Invalid credit configuration',
        details: errors,
      });
    }

    next();

  } catch (error) {
    console.error('Credit config validation error:', error);
    res.status(500).json({
      error: 'Validation failed',
    });
  }
};

module.exports = {
  checkCreditBeforeOrder,
  requireCreditAdmin,
  validateCreditConfig,
};
