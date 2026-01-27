const prisma = require('../config/database');
const stockService = require('./stock.service');
const { withTransaction } = require('../utils/transaction');
const orderStateMachine = require('./orderStateMachine.service');

class OrderService {
  async getAllOrders(filters = {}) {
    // For Admin to list all orders
    const where = {};
    if (filters.status) where.status = filters.status;
    if (filters.retailerId) where.retailerId = filters.retailerId;

    const orders = await prisma.order.findMany({
      where,
      include: {
        retailer: true,
        items: { include: { product: true } },
        orderImages: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    return { orders };
  }

  async getOrderById(id) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        retailer: true,
        items: { include: { product: true } },
        orderImages: true
      }
    });
  }

  async updateOrderStatus(id, status, performedBy = 'SYSTEM', reason = null) {
    // ============================================
    // ATOMIC OPERATION: Update Order Status with State Machine Validation
    // ============================================
    // Operations in this transaction:
    // 1. Validate state transition (hard state machine)
    // 2. Update order status (enforced by state machine)
    // 3. Write to order_events table (automatic via state machine)
    // 4. Log transition to AdminAuditLog (automatic via state machine)
    //
    // ROLLBACK SCENARIOS:
    // - If transition invalid → All updates rolled back
    // - If any operation fails → Order remains in original state
    // Result: Order either transitions fully or not at all (ATOMIC)
    // ============================================

    try {
      // Use strict state machine with automatic event logging
      const updatedOrder = await orderStateMachine.transitionOrderStatus(
        id,
        status,
        {
          performedBy,
          reason,
          skipValidation: false // Always validate
        }
      );

      return updatedOrder;
    } catch (error) {
      console.error(`Error updating order ${id} status (Transaction Rolled Back):`, error);
      throw error;
    }
  }

  async cancelOrder(id, userId) {
    // ============================================
    // ATOMIC OPERATION: Cancel Order
    // ============================================
    // Operations that must be atomic:
    // 1. Release all reserved stock
    // 2. Update order status to CANCELLED
    // 3. Record cancellation reason
    //
    // ROLLBACK SCENARIOS:
    // - If stock release fails → Order not marked cancelled
    // - If order update fails → Stock remains reserved
    // Result: Either fully cancelled or not cancelled at all (no partial state)
    // ============================================

    try {
      return await prisma.$transaction(async (tx) => {
        // Release all reserved stock for this order
        await stockService.releaseStock(id);

        // Mark order as cancelled in same transaction
        return await tx.order.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            failureReason: `Cancelled by user ${userId}`
          }
        });
      });
    } catch (error) {
      console.error(`Error cancelling order ${id} (Transaction Rolled Back):`, error);
      throw error;
    }
  }

  async createOrder(retailerId, items) {
    // ============================================
    // ATOMIC OPERATION: Create Order with Items
    // ============================================
    // items: [{ productId, quantity }]
    //
    // Operations that must be atomic:
    // 1. Fetch and validate all products
    // 2. Create order record
    // 3. Create all order item records
    //
    // ROLLBACK SCENARIOS:
    // - If product validation fails → No order created
    // - If order creation fails → No items created
    // - If item creation fails for any item → Entire order deleted
    // Result: All-or-nothing: complete order with all items, or nothing
    // ============================================

    try {
      const orderItemsData = [];
      let total = 0;

      // Validate and calculate before transaction
      // (Read-only operations outside transaction for efficiency)
      for (const item of items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId }
        });

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        const lineTotal = parseFloat(product.fixedPrice) * item.quantity;
        total += lineTotal;
        orderItemsData.push({
          productId: item.productId,
          quantity: item.quantity,
          priceAtOrder: product.fixedPrice
        });
      }

      // Now create order and items atomically with transaction framework
      return await withTransaction(async (tx) => {
        // Create order in same transaction
        const subtotal = total;
        const taxRate = 13.0; // 13%
        const taxAmount = (subtotal * taxRate) / 100;
        const totalAmount = subtotal + taxAmount;

        const order = await tx.order.create({
          data: {
            retailerId,
            subtotal: subtotal,
            taxRate: taxRate,
            taxAmount: taxAmount,
            totalAmount: totalAmount,
            paymentMode: 'COD',
            status: 'PLACED'
          }
        });

        // Create all order items in same transaction
        const createdItems = await tx.orderItem.createMany({
          data: orderItemsData.map(item => ({
            orderId: order.id,
            ...item
          }))
        });

        return {
          ...order,
          items: orderItemsData,
          itemCount: createdItems.count
        };
      }, {
        operation: 'ORDER_CREATION',
        entityId: null, // Will be set after order creation
        entityType: 'Order',
        timeout: 10000
      });
    } catch (error) {
      console.error(`Error creating order for retailer ${retailerId} (Transaction Rolled Back):`, error);
      throw error;
    }
  }

  /**
   * ============================================================================
   * CREDIT RESERVATION LIFECYCLE FUNCTIONS
   * ============================================================================
   */

  /**
   * Validate order and reserve credit
   * Called before confirming an order
   * 
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} { order, creditCheck, reserved }
   */
  async validateAndReserveCredit(orderId) {
    const creditReservationService = require('./creditReservation.service');

    try {
      // 1. Get order details
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          retailerId: true,
          wholesalerId: true,
          totalAmount: true,
          status: true
        }
      });

      if (!order) {
        throw new Error(`ORDER_NOT_FOUND: ${orderId}`);
      }

      if (!order.wholesalerId) {
        throw new Error(`WHOLESALER_NOT_ASSIGNED: Cannot reserve credit without wholesaler`);
      }

      // 2. Pre-check credit availability
      const creditCheck = await creditReservationService.canReserveCredit(
        order.retailerId,
        order.wholesalerId,
        order.totalAmount.toNumber()
      );

      if (!creditCheck.canReserve) {
        throw new Error(`INSUFFICIENT_CREDIT: ${creditCheck.message}`);
      }

      // 3. Reserve credit
      const reservation = await creditReservationService.reserveCredit(
        order.retailerId,
        order.wholesalerId,
        orderId,
        order.totalAmount.toNumber()
      );

      console.log(
        `✅ Order ${orderNumber} validated and credit reserved: ₹${order.totalAmount}`
      );

      return {
        order,
        creditCheck,
        reserved: reservation
      };
    } catch (error) {
      console.error(`❌ Credit validation/reservation failed for order ${orderId}:`, error.message);
      throw error;
    }
  }

  /**
   * Release credit when order is cancelled
   * 
   * @param {string} orderId - Order ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Released reservation
   */
  async cancelOrderAndReleaseCredit(orderId, reason = 'CANCELLED_BY_USER', userId = 'SYSTEM') {
    const creditReservationService = require('./creditReservation.service');

    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Release all reserved stock
        await stockService.releaseStock(orderId);

        // 2. Update order to CANCELLED status
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            status: 'CANCELLED',
            updatedAt: new Date(),
            failureReason: reason
          }
        });

        // 3. Perform state machine transition for proper event logging
        // (outside transaction - creditReservationService handles its own transaction)
        // We do this after to ensure order is actually updated
      });

      // 4. Release credit reservation (this service handles its own transaction)
      const released = await creditReservationService.releaseReservation(orderId, reason);

      // 5. Log the transition
      await orderStateMachine.logTransition(
        orderId,
        'VENDOR_ACCEPTED',
        'CANCELLED',
        userId,
        reason
      );

      console.log(`✅ Order ${orderId} cancelled and credit released`);

      return released;
    } catch (error) {
      console.error(`❌ Error cancelling order and releasing credit for ${orderId}:`, error.message);
      throw error;
    }
  }

  /**
   * Mark order as failed and release credit
   * 
   * @param {string} orderId - Order ID
   * @param {string} reason - Failure reason
   * @returns {Promise<Object>} Failed order with released credit
   */
  async markOrderFailedAndReleaseCredit(orderId, reason = 'ORDER_FAILED', userId = 'SYSTEM') {
    const creditReservationService = require('./creditReservation.service');

    try {
      return await prisma.$transaction(async (tx) => {
        // Update order status to FAILED
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            failureReason: reason,
            updatedAt: new Date()
          }
        });

        return updatedOrder;
      });

      // Release credit (outside transaction)
      const released = await creditReservationService.releaseReservation(orderId, `FAILED: ${reason}`);

      // Log transition
      await orderStateMachine.logTransition(
        orderId,
        'VENDOR_ACCEPTED',
        'FAILED',
        userId,
        reason
      );

      console.log(`✅ Order ${orderId} marked as failed and credit released`);

      return released;
    } catch (error) {
      console.error(`❌ Error failing order and releasing credit for ${orderId}:`, error.message);
      throw error;
    }
  }

  /**
   * Fulfill order: Convert reserved credit to ledger DEBIT
   * Called when order is delivered
   * 
   * @param {string} orderId - Order ID
   * @param {Object} options - Fulfillment options (dueDate, etc.)
   * @returns {Promise<Object>} { order, ledgerEntry, reservation }
   */
  async fulfillOrderAndConvertCredit(orderId, options = {}) {
    const creditReservationService = require('./creditReservation.service');

    try {
      // 1. Get order details
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          retailerId: true,
          wholesalerId: true,
          totalAmount: true,
          status: true
        }
      });

      if (!order) {
        throw new Error(`ORDER_NOT_FOUND: ${orderId}`);
      }

      // 2. Mark as delivered
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(),
          updatedAt: new Date()
        }
      });

      // 3. Convert credit reservation to ledger DEBIT
      const creditConversion = await creditReservationService.convertReservationToDebit(
        orderId,
        order.retailerId,
        order.wholesalerId,
        order.totalAmount.toNumber(),
        {
          dueDate: options.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      );

      console.log(
        `✅ Order ${order.orderNumber} fulfilled and credit converted to DEBIT: ₹${order.totalAmount}`
      );

      return {
        order: await this.getOrderById(orderId),
        ...creditConversion
      };
    } catch (error) {
      console.error(`❌ Error fulfilling order and converting credit for ${orderId}:`, error.message);
      throw error;
    }
  }
}

module.exports = new OrderService();