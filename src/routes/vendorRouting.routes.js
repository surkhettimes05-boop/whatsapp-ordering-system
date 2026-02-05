/**
 * Vendor Routing Routes
 * 
 * Handles multi-vendor order distribution and response tracking
 * All endpoints are race-condition safe
 */

const express = require('express');
const router = express.Router();
const VendorRoutingService = require('../services/vendorRouting.service');
const { AppError, ErrorTypes } = require('../utils/errors');

const { authenticate, isAdmin } = require('../middleware/auth.middleware');

// ============================================================================
// POST /api/orders/:orderId/route-to-vendors
// ============================================================================
// Route an order to multiple vendors (called when order is created)
// 
// Body: { retailerId, productCategory }
// Response: { routingId, orderId, status: 'PENDING_RESPONSES' }
// ============================================================================

router.post('/orders/:orderId/route-to-vendors', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { retailerId, productCategory } = req.body;

    // Validation
    if (!orderId || !retailerId) {
      throw new AppError('orderId and retailerId are required', ErrorTypes.INVALID_REQUEST);
    }

    const result = await VendorRoutingService.routeOrderToVendors(
      orderId,
      retailerId,
      productCategory
    );

    res.status(201).json({
      success: true,
      message: 'Order routed to vendors',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// POST /api/routing/:routingId/vendor-response
// ============================================================================
// Record a vendor's response to routing (ACCEPTED or REJECTED)
// Called when vendor responds via WhatsApp or API
// 
// Body: { vendorId, response: 'ACCEPTED' | 'REJECTED' }
// Response: { responseId, vendorId, response }
// ============================================================================

router.post('/routing/:routingId/vendor-response', async (req, res, next) => {
  try {
    const { routingId } = req.params;
    const { vendorId, response } = req.body;

    // Validation
    if (!routingId || !vendorId || !response) {
      throw new AppError(
        'routingId, vendorId, and response are required',
        ErrorTypes.INVALID_REQUEST
      );
    }

    if (!['ACCEPTED', 'REJECTED'].includes(response.toUpperCase())) {
      throw new AppError(
        'response must be ACCEPTED or REJECTED',
        ErrorTypes.INVALID_REQUEST
      );
    }

    const result = await VendorRoutingService.respondToVendor(
      routingId,
      vendorId,
      response.toUpperCase()
    );

    res.status(201).json({
      success: true,
      message: 'Vendor response recorded',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// POST /api/routing/:routingId/accept
// ============================================================================
// Vendor attempts to accept the order (RACE-SAFE)
// Only the first vendor to call this wins. Others get rejection.
// 
// Body: { vendorId }
// Response: { routingId, winnerId, status: 'VENDOR_ACCEPTED' }
// Error: "Another vendor already accepted" if race lost
// ============================================================================

router.post('/routing/:routingId/accept', async (req, res, next) => {
  try {
    const { routingId } = req.params;
    const { vendorId } = req.body;

    // Validation
    if (!routingId || !vendorId) {
      throw new AppError('routingId and vendorId are required', ErrorTypes.INVALID_REQUEST);
    }

    // Attempt to accept order
    const acceptResult = await VendorRoutingService.acceptVendor(routingId, vendorId);

    // If successful, send auto-cancellations to other vendors
    if (acceptResult.status === 'VENDOR_ACCEPTED' && !acceptResult.alreadyAccepted) {
      await VendorRoutingService.sendAutoCancellations(routingId, vendorId)
        .catch(error => {
          console.error('Failed to send auto-cancellations:', error);
          // Don't fail the acceptance if cancellations fail
        });
    }

    res.status(200).json({
      success: true,
      message: 'Order accepted successfully',
      data: acceptResult
    });
  } catch (error) {
    // Check if it's a race condition loss (another vendor won)
    if (error.message && error.message.includes('already accepted')) {
      return res.status(409).json({
        success: false,
        error: error.message,
        code: 'RACE_CONDITION_LOST'
      });
    }
    next(error);
  }
});

// ============================================================================
// GET /api/routing/:routingId/status
// ============================================================================
// Get complete routing status
// 
// Response: {
//   routingId,
//   orderId,
//   status: 'PENDING_RESPONSES' | 'VENDOR_ACCEPTED',
//   winnerId,
//   totalVendorsContacted,
//   acceptedCount,
//   rejectedCount,
//   cancelledCount,
//   acceptedAt
// }
// ============================================================================

router.get('/routing/:routingId/status', async (req, res, next) => {
  try {
    const { routingId } = req.params;

    if (!routingId) {
      throw new AppError('routingId is required', ErrorTypes.INVALID_REQUEST);
    }

    const status = await VendorRoutingService.getRoutingStatus(routingId);

    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// POST /api/routing/:routingId/timeout
// ============================================================================
// Mark a vendor's response as timed out
// Called when no response received within timeout period
// 
// Body: { vendorId }
// Response: { routingId, vendorId, status: 'TIMEOUT' }
// ============================================================================

router.post('/routing/:routingId/timeout', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { routingId } = req.params;
    const { vendorId } = req.body;

    if (!routingId || !vendorId) {
      throw new AppError('routingId and vendorId are required', ErrorTypes.INVALID_REQUEST);
    }

    const result = await VendorRoutingService.timeoutVendor(routingId, vendorId);

    res.status(200).json({
      success: true,
      message: 'Vendor marked as timed out',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Error Handler Middleware
// ============================================================================

router.use((error, req, res, next) => {
  if (error instanceof AppError) {
    return res.status(400).json({
      success: false,
      error: error.message,
      code: error.type
    });
  }

  // Prisma errors
  if (error.code === 'P2025') {
    // Record not found
    return res.status(404).json({
      success: false,
      error: 'Routing not found',
      code: 'NOT_FOUND'
    });
  }

  if (error.code === 'P2002') {
    // Unique constraint violation
    return res.status(409).json({
      success: false,
      error: 'Vendor has already responded',
      code: 'CONFLICT'
    });
  }

  // Generic error
  console.error('Vendor routing error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

module.exports = router;
