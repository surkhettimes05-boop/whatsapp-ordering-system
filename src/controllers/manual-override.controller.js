/**
 * Manual Override Controller
 * Admin controls for freezing retailers, pausing vendors, reassigning orders, and adjusting credit
 */

const prisma = require('../config/database');
const adminService = require('../services/admin.service');
const creditService = require('../services/credit.service');
const vendorRoutingService = require('../services/vendor-routing.service');
const { logger } = require('../infrastructure/logger');
const { withTransaction } = require('../utils/transaction');

class ManualOverrideController {

  // ============================================================================
  // RETAILER MANAGEMENT
  // ============================================================================

  /**
   * Freeze/Unfreeze retailer account
   * POST /api/v1/dashboard/overrides/retailer/:id/freeze
   */
  async freezeRetailer(req, res) {
    try {
      const { id: retailerId } = req.params;
      const { freeze = true, reason, duration } = req.body;
      const adminId = req.user.id;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Reason is required for retailer freeze/unfreeze'
        });
      }

      const result = await withTransaction(async (tx) => {
        // Update retailer status
        const retailer = await tx.retailer.update({
          where: { id: retailerId },
          data: {
            isActive: !freeze,
            status: freeze ? 'SUSPENDED' : 'ACTIVE',
            suspendedAt: freeze ? new Date() : null,
            suspendedUntil: duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null
          }
        });

        // Cancel pending orders if freezing
        if (freeze) {
          const pendingOrders = await tx.order.findMany({
            where: {
              retailerId,
              status: {
                in: ['CREATED', 'PENDING_BIDS', 'CREDIT_APPROVED', 'STOCK_RESERVED']
              }
            }
          });

          for (const order of pendingOrders) {
            await adminService.forceCancelOrder(adminId, order.id, `Retailer frozen: ${reason}`, tx);
          }
        }

        // Log admin action
        await tx.adminAuditLog.create({
          data: {
            adminId,
            action: freeze ? 'RETAILER_FROZEN' : 'RETAILER_UNFROZEN',
            targetId: retailerId,
            reason,
            metadata: JSON.stringify({
              duration,
              previousStatus: retailer.status,
              cancelledOrders: freeze ? pendingOrders?.length || 0 : 0
            })
          }
        });

        return {
          retailer,
          cancelledOrders: freeze ? pendingOrders?.length || 0 : 0
        };
      });

      logger.info(`Retailer ${freeze ? 'frozen' : 'unfrozen'}`, {
        action: freeze ? 'retailer_frozen' : 'retailer_unfrozen',
        retailerId,
        adminId,
        reason
      });

      res.json({
        success: true,
        message: `Retailer ${freeze ? 'frozen' : 'unfrozen'} successfully`,
        data: result
      });

    } catch (error) {
      logger.error('Failed to freeze/unfreeze retailer', {
        error: error.message,
        retailerId: req.params.id,
        adminId: req.user.id
      });
      res.status(500).json({
        success: false,
        error: 'Failed to freeze/unfreeze retailer',
        message: error.message
      });
    }
  }

  /**
   * Adjust retailer credit limit
   * POST /api/v1/dashboard/overrides/retailer/:id/credit
   */
  async adjustRetailerCredit(req, res) {
    try {
      const { id: retailerId } = req.params;
      const { wholesalerId, newCreditLimit, reason } = req.body;
      const adminId = req.user.id;

      if (!wholesalerId || newCreditLimit === undefined || !reason) {
        return res.status(400).json({
          success: false,
          error: 'wholesalerId, newCreditLimit, and reason are required'
        });
      }

      // Get current account
      const currentAccount = await creditService.getOrCreateCreditAccount(retailerId, wholesalerId);
      const currentBalance = await creditService.calculateBalance(retailerId, wholesalerId);

      // Validate new limit
      if (newCreditLimit < 0) {
        return res.status(400).json({
          success: false,
          error: 'Credit limit cannot be negative'
        });
      }

      if (newCreditLimit < currentBalance) {
        return res.status(400).json({
          success: false,
          error: `New credit limit (₹${newCreditLimit}) cannot be less than current balance (₹${currentBalance})`
        });
      }

      const result = await withTransaction(async (tx) => {
        // Update credit account
        const updatedAccount = await tx.creditAccount.update({
          where: {
            retailerId_wholesalerId: {
              retailerId,
              wholesalerId
            }
          },
          data: {
            creditLimit: newCreditLimit,
            updatedAt: new Date()
          }
        });

        // Log admin action
        await tx.adminAuditLog.create({
          data: {
            adminId,
            action: 'CREDIT_LIMIT_ADJUSTED',
            targetId: retailerId,
            reason,
            metadata: JSON.stringify({
              wholesalerId,
              previousLimit: Number(currentAccount.creditLimit),
              newLimit: newCreditLimit,
              currentBalance
            })
          }
        });

        return updatedAccount;
      });

      logger.info('Credit limit adjusted', {
        action: 'credit_limit_adjusted',
        retailerId,
        wholesalerId,
        previousLimit: Number(currentAccount.creditLimit),
        newLimit: newCreditLimit,
        adminId,
        reason
      });

      res.json({
        success: true,
        message: 'Credit limit adjusted successfully',
        data: {
          account: result,
          previousLimit: Number(currentAccount.creditLimit),
          newLimit: newCreditLimit,
          currentBalance,
          availableCredit: newCreditLimit - currentBalance
        }
      });

    } catch (error) {
      logger.error('Failed to adjust credit limit', {
        error: error.message,
        retailerId: req.params.id,
        adminId: req.user.id
      });
      res.status(500).json({
        success: false,
        error: 'Failed to adjust credit limit',
        message: error.message
      });
    }
  }

  // ============================================================================
  // VENDOR MANAGEMENT
  // ============================================================================

  /**
   * Pause/Unpause vendor
   * POST /api/v1/dashboard/overrides/vendor/:id/pause
   */
  async pauseVendor(req, res) {
    try {
      const { id: vendorId } = req.params;
      const { pause = true, reason, duration } = req.body;
      const adminId = req.user.id;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Reason is required for vendor pause/unpause'
        });
      }

      const result = await withTransaction(async (tx) => {
        // Update vendor status
        const vendor = await tx.wholesaler.update({
          where: { id: vendorId },
          data: {
            isActive: !pause,
            status: pause ? 'SUSPENDED' : 'ACTIVE',
            suspendedAt: pause ? new Date() : null,
            suspendedUntil: duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null
          }
        });

        // Handle pending orders if pausing
        let reassignedOrders = 0;
        if (pause) {
          const pendingOrders = await tx.order.findMany({
            where: {
              wholesalerId: vendorId,
              status: {
                in: ['PENDING_BIDS', 'CREDIT_APPROVED', 'STOCK_RESERVED', 'WHOLESALER_ACCEPTED']
              }
            }
          });

          // Try to reassign orders to other vendors
          for (const order of pendingOrders) {
            try {
              await this.reassignOrderToAlternativeVendor(order.id, vendorId, `Vendor paused: ${reason}`, adminId, tx);
              reassignedOrders++;
            } catch (error) {
              logger.warn('Failed to reassign order during vendor pause', {
                orderId: order.id,
                vendorId,
                error: error.message
              });
              // Cancel order if reassignment fails
              await adminService.forceCancelOrder(adminId, order.id, `Vendor paused and reassignment failed: ${reason}`, tx);
            }
          }
        }

        // Log admin action
        await tx.adminAuditLog.create({
          data: {
            adminId,
            action: pause ? 'VENDOR_PAUSED' : 'VENDOR_UNPAUSED',
            targetId: vendorId,
            reason,
            metadata: JSON.stringify({
              duration,
              previousStatus: vendor.status,
              reassignedOrders
            })
          }
        });

        return {
          vendor,
          reassignedOrders
        };
      });

      logger.info(`Vendor ${pause ? 'paused' : 'unpaused'}`, {
        action: pause ? 'vendor_paused' : 'vendor_unpaused',
        vendorId,
        adminId,
        reason,
        reassignedOrders: result.reassignedOrders
      });

      res.json({
        success: true,
        message: `Vendor ${pause ? 'paused' : 'unpaused'} successfully`,
        data: result
      });

    } catch (error) {
      logger.error('Failed to pause/unpause vendor', {
        error: error.message,
        vendorId: req.params.id,
        adminId: req.user.id
      });
      res.status(500).json({
        success: false,
        error: 'Failed to pause/unpause vendor',
        message: error.message
      });
    }
  }

  // ============================================================================
  // ORDER MANAGEMENT
  // ============================================================================

  /**
   * Reassign order to different vendor
   * POST /api/v1/dashboard/overrides/order/:id/reassign
   */
  async reassignOrder(req, res) {
    try {
      const { id: orderId } = req.params;
      const { newVendorId, reason } = req.body;
      const adminId = req.user.id;

      if (!newVendorId || !reason) {
        return res.status(400).json({
          success: false,
          error: 'newVendorId and reason are required'
        });
      }

      // Validate order can be reassigned
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          retailer: { select: { pasalName: true } },
          wholesaler: { select: { businessName: true } },
          items: true
        }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      if (!['PENDING_BIDS', 'CREDIT_APPROVED', 'STOCK_RESERVED', 'WHOLESALER_ACCEPTED'].includes(order.status)) {
        return res.status(400).json({
          success: false,
          error: `Cannot reassign order with status ${order.status}`
        });
      }

      // Validate new vendor
      const newVendor = await prisma.wholesaler.findUnique({
        where: { id: newVendorId },
        select: { id: true, businessName: true, isActive: true }
      });

      if (!newVendor || !newVendor.isActive) {
        return res.status(400).json({
          success: false,
          error: 'New vendor not found or inactive'
        });
      }

      const result = await withTransaction(async (tx) => {
        const previousVendorId = order.wholesalerId;

        // Release stock reservations from previous vendor
        if (order.status === 'STOCK_RESERVED') {
          await this.releaseStockReservations(orderId, tx);
        }

        // Update order with new vendor
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            wholesalerId: newVendorId,
            status: 'PENDING_BIDS', // Reset to allow new vendor to accept
            updatedAt: new Date()
          }
        });

        // Create order event
        await tx.orderEvent.create({
          data: {
            orderId,
            eventType: 'ORDER_REASSIGNED',
            description: `Order reassigned from ${order.wholesaler.businessName} to ${newVendor.businessName}`,
            metadata: JSON.stringify({
              previousVendorId,
              newVendorId,
              reason,
              adminId
            })
          }
        });

        // Update routing record
        await tx.orderRouting.updateMany({
          where: { orderId },
          data: {
            selectedVendorId: newVendorId,
            updatedAt: new Date()
          }
        });

        // Log admin action
        await tx.adminAuditLog.create({
          data: {
            adminId,
            action: 'ORDER_REASSIGNED',
            targetId: orderId,
            reason,
            metadata: JSON.stringify({
              previousVendorId,
              newVendorId,
              orderStatus: order.status
            })
          }
        });

        return {
          order: updatedOrder,
          previousVendor: order.wholesaler.businessName,
          newVendor: newVendor.businessName
        };
      });

      logger.info('Order reassigned', {
        action: 'order_reassigned',
        orderId,
        previousVendorId: order.wholesalerId,
        newVendorId,
        adminId,
        reason
      });

      res.json({
        success: true,
        message: 'Order reassigned successfully',
        data: result
      });

    } catch (error) {
      logger.error('Failed to reassign order', {
        error: error.message,
        orderId: req.params.id,
        adminId: req.user.id
      });
      res.status(500).json({
        success: false,
        error: 'Failed to reassign order',
        message: error.message
      });
    }
  }

  /**
   * Force order status change
   * POST /api/v1/dashboard/overrides/order/:id/status
   */
  async forceOrderStatus(req, res) {
    try {
      const { id: orderId } = req.params;
      const { newStatus, reason, skipValidation = false } = req.body;
      const adminId = req.user.id;

      if (!newStatus || !reason) {
        return res.status(400).json({
          success: false,
          error: 'newStatus and reason are required'
        });
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, retailerId: true, wholesalerId: true }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      // Validate status transition (unless skipped)
      if (!skipValidation) {
        const validTransitions = this.getValidStatusTransitions(order.status);
        if (!validTransitions.includes(newStatus)) {
          return res.status(400).json({
            success: false,
            error: `Invalid status transition from ${order.status} to ${newStatus}`,
            validTransitions
          });
        }
      }

      const result = await withTransaction(async (tx) => {
        // Update order status
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            status: newStatus,
            updatedAt: new Date()
          }
        });

        // Create order event
        await tx.orderEvent.create({
          data: {
            orderId,
            eventType: 'STATUS_FORCED',
            description: `Status forced from ${order.status} to ${newStatus}`,
            metadata: JSON.stringify({
              previousStatus: order.status,
              newStatus,
              reason,
              adminId,
              skipValidation
            })
          }
        });

        // Log admin action
        await tx.adminAuditLog.create({
          data: {
            adminId,
            action: 'ORDER_STATUS_FORCED',
            targetId: orderId,
            reason,
            metadata: JSON.stringify({
              previousStatus: order.status,
              newStatus,
              skipValidation
            })
          }
        });

        return updatedOrder;
      });

      logger.info('Order status forced', {
        action: 'order_status_forced',
        orderId,
        previousStatus: order.status,
        newStatus,
        adminId,
        reason
      });

      res.json({
        success: true,
        message: 'Order status updated successfully',
        data: {
          order: result,
          previousStatus: order.status,
          newStatus
        }
      });

    } catch (error) {
      logger.error('Failed to force order status', {
        error: error.message,
        orderId: req.params.id,
        adminId: req.user.id
      });
      res.status(500).json({
        success: false,
        error: 'Failed to force order status',
        message: error.message
      });
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get valid status transitions for an order status
   */
  getValidStatusTransitions(currentStatus) {
    const transitions = {
      'CREATED': ['PENDING_BIDS', 'CANCELLED'],
      'PENDING_BIDS': ['CREDIT_APPROVED', 'CANCELLED', 'FAILED'],
      'CREDIT_APPROVED': ['STOCK_RESERVED', 'CANCELLED', 'FAILED'],
      'STOCK_RESERVED': ['WHOLESALER_ACCEPTED', 'CANCELLED', 'FAILED'],
      'WHOLESALER_ACCEPTED': ['CONFIRMED', 'CANCELLED'],
      'CONFIRMED': ['PROCESSING', 'CANCELLED'],
      'PROCESSING': ['PACKED', 'CANCELLED'],
      'PACKED': ['OUT_FOR_DELIVERY', 'CANCELLED'],
      'OUT_FOR_DELIVERY': ['SHIPPED', 'DELIVERED', 'CANCELLED'],
      'SHIPPED': ['DELIVERED', 'RETURNED'],
      'DELIVERED': ['RETURNED'],
      'CANCELLED': [],
      'FAILED': [],
      'RETURNED': []
    };

    return transitions[currentStatus] || [];
  }

  /**
   * Release stock reservations for an order
   */
  async releaseStockReservations(orderId, tx = prisma) {
    const reservations = await tx.stockReservation.findMany({
      where: { orderId, status: 'ACTIVE' }
    });

    for (const reservation of reservations) {
      // Release reserved stock
      await tx.wholesalerProduct.update({
        where: { id: reservation.wholesalerProductId },
        data: {
          reservedStock: { decrement: reservation.quantity }
        }
      });

      // Mark reservation as released
      await tx.stockReservation.update({
        where: { id: reservation.id },
        data: { status: 'RELEASED' }
      });
    }

    return reservations.length;
  }

  /**
   * Reassign order to alternative vendor (helper for vendor pause)
   */
  async reassignOrderToAlternativeVendor(orderId, excludeVendorId, reason, adminId, tx = prisma) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });

    if (!order) throw new Error('Order not found');

    // Find alternative vendors using routing service
    const orderData = {
      deliveryAddress: order.deliveryAddress,
      items: order.items,
      totalAmount: order.totalAmount,
      requiresCredit: true
    };

    const routingResult = await vendorRoutingService.routeOrder(orderId, orderData);
    const alternativeVendors = [routingResult.primary, ...routingResult.fallbacks]
      .filter(v => v && v.id !== excludeVendorId);

    if (alternativeVendors.length === 0) {
      throw new Error('No alternative vendors available');
    }

    const newVendor = alternativeVendors[0];

    // Update order
    await tx.order.update({
      where: { id: orderId },
      data: {
        wholesalerId: newVendor.id,
        status: 'PENDING_BIDS'
      }
    });

    // Create order event
    await tx.orderEvent.create({
      data: {
        orderId,
        eventType: 'ORDER_REASSIGNED',
        description: `Order automatically reassigned due to vendor pause`,
        metadata: JSON.stringify({
          previousVendorId: excludeVendorId,
          newVendorId: newVendor.id,
          reason,
          adminId,
          automatic: true
        })
      }
    });

    return newVendor;
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  /**
   * Bulk freeze retailers
   * POST /api/v1/dashboard/overrides/retailers/bulk-freeze
   */
  async bulkFreezeRetailers(req, res) {
    try {
      const { retailerIds, freeze = true, reason, duration } = req.body;
      const adminId = req.user.id;

      if (!retailerIds || !Array.isArray(retailerIds) || retailerIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'retailerIds array is required'
        });
      }

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Reason is required for bulk freeze/unfreeze'
        });
      }

      const results = [];
      const errors = [];

      for (const retailerId of retailerIds) {
        try {
          const result = await withTransaction(async (tx) => {
            const retailer = await tx.retailer.update({
              where: { id: retailerId },
              data: {
                isActive: !freeze,
                status: freeze ? 'SUSPENDED' : 'ACTIVE',
                suspendedAt: freeze ? new Date() : null,
                suspendedUntil: duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null
              }
            });

            await tx.adminAuditLog.create({
              data: {
                adminId,
                action: freeze ? 'RETAILER_BULK_FROZEN' : 'RETAILER_BULK_UNFROZEN',
                targetId: retailerId,
                reason,
                metadata: JSON.stringify({ duration, bulkOperation: true })
              }
            });

            return retailer;
          });

          results.push({ retailerId, success: true, retailer: result });
        } catch (error) {
          errors.push({ retailerId, error: error.message });
        }
      }

      logger.info(`Bulk ${freeze ? 'freeze' : 'unfreeze'} retailers completed`, {
        action: freeze ? 'bulk_freeze_retailers' : 'bulk_unfreeze_retailers',
        adminId,
        totalRequested: retailerIds.length,
        successful: results.length,
        failed: errors.length
      });

      res.json({
        success: true,
        message: `Bulk ${freeze ? 'freeze' : 'unfreeze'} completed`,
        data: {
          successful: results,
          failed: errors,
          summary: {
            total: retailerIds.length,
            successful: results.length,
            failed: errors.length
          }
        }
      });

    } catch (error) {
      logger.error('Failed to bulk freeze/unfreeze retailers', {
        error: error.message,
        adminId: req.user.id
      });
      res.status(500).json({
        success: false,
        error: 'Failed to bulk freeze/unfreeze retailers',
        message: error.message
      });
    }
  }
}

module.exports = new ManualOverrideController();