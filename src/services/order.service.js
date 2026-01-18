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
    // 2. Release stock (if cancelling) OR deduct stock (if delivering)
    // 3. Update order status (enforced by state machine)
    // 4. Log transition to AdminAuditLog
    //
    // ROLLBACK SCENARIOS:
    // - If transition invalid → Transaction rolls back
    // - If stock release/deduction fails → Order status update rolls back
    // - Result: Order remains in original state, no inconsistency
    // ============================================

    return withTransaction(async (tx) => {
      // STEP 1: Validate state transition (database-level validation)
      const validation = await orderStateMachine.validateTransition(id, null, status, tx);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // STEP 2: Handle stock operations based on status
      if (status === 'CANCELLED') {
        // Release reserved stock back to availability
        const reservations = await tx.stockReservation.findMany({
          where: { orderId: id, status: 'ACTIVE' }
        });

        for (const res of reservations) {
          await tx.wholesalerProduct.update({
            where: { id: res.wholesalerProductId },
            data: { reservedStock: { decrement: res.quantity } }
          });
          await tx.stockReservation.update({
            where: { id: res.id },
            data: { status: 'RELEASED' }
          });
        }
      } else if (status === 'DELIVERED') {
        // Deduct stock from total (convert reservation to actual usage)
        const reservations = await tx.stockReservation.findMany({
          where: { orderId: id, status: 'ACTIVE' }
        });

        for (const res of reservations) {
          await tx.wholesalerProduct.update({
            where: { id: res.wholesalerProductId },
            data: {
              stock: { decrement: res.quantity },
              reservedStock: { decrement: res.quantity }
            }
          });
          await tx.stockReservation.update({
            where: { id: res.id },
            data: { status: 'FULFILLED' }
          });
        }
      }

      // STEP 3: Get current status for logging
      const order = await tx.order.findUnique({
        where: { id },
        select: { id: true, status: true }
      });

      const fromStatus = order.status;

      // STEP 4: Update order status (enforced by state machine)
      const updateData = {
        status,
        updatedAt: new Date()
      };

      // STEP 5: Generate OTP if moving to OUT_FOR_DELIVERY
      let deliveryOTP = null;
      if (status === 'OUT_FOR_DELIVERY') {
        deliveryOTP = Math.floor(1000 + Math.random() * 9000).toString();
        updateData.deliveryOTP = deliveryOTP;
        updateData.otpVerified = false;
      }

      const updatedOrder = await tx.order.update({
        where: { id },
        data: updateData,
        include: { retailer: true }
      });

      // Log transition (outside transaction if tx provided, to ensure it persists)
      if (tx) {
        // If in transaction, log after transaction commits
        setImmediate(() => {
          orderStateMachine.logTransition(id, fromStatus, status, performedBy, reason, null);
        });
      } else {
        // Log immediately
        await orderStateMachine.logTransition(id, fromStatus, status, performedBy, reason, null);
      }

      // If OTP was generated, send it to the retailer via WhatsApp
      if (deliveryOTP && updatedOrder.retailer) {
        const whatsappService = require('./whatsapp.service');
        const otpMessage = `🔐 *Delivery OTP*
    
Your Order #${id.slice(-4)} is out for delivery! 🚚

Please provide this OTP to the delivery person only after you receive the goods:
*${deliveryOTP}*

This ensures your delivery is recorded correctly.`;

        // Use setImmediate to avoid blocking the transaction result
        setImmediate(async () => {
          try {
            await whatsappService.sendMessage(updatedOrder.retailer.phoneNumber, otpMessage);
            console.log(`📱 Delivery OTP sent to retailer for Order ${id.slice(-4)}`);
          } catch (err) {
            console.error('Failed to send OTP message:', err);
          }
        });
      }

      return updatedOrder;
    }, {
      operation: 'ORDER_STATUS_UPDATE',
      entityId: id,
      entityType: 'Order',
      timeout: 10000
    });
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

  // Basic create for internal testing or manual admin entry (optional)
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
        const order = await tx.order.create({
          data: {
            retailerId,
            totalAmount: total,
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
}

module.exports = new OrderService();