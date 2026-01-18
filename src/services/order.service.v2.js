const prisma = require('../config/database');
const inventoryService = require('./inventory.service');
const creditService = require('./credit.service');

/**
 * Enhanced Order Service with Inventory Truth Layer
 * 
 * Flow:
 * 1. Validate retailer & credit
 * 2. Find best wholesaler (with stock check)
 * 3. Reserve stock atomically
 * 4. Create order with reserved status
 * 5. On delivery: Deduct stock
 * 6. On cancellation: Release stock
 */
class OrderServiceV2 {
  /**
   * Create order with complete inventory workflow
   * 
   * @param {string} retailerId - Retailer placing order
   * @param {string} wholesalerId - Target wholesaler (pre-selected)
   * @param {Array<{productId: string, quantity: number}>} items - Order items
   * @param {Object} options - { paymentMode: 'COD'|'CREDIT', ... }
   * @returns {Promise<Object>} Created order with reserved stock
   */
  async createOrderWithInventory(retailerId, wholesalerId, items, options = {}) {
    if (!retailerId || !wholesalerId || !items || items.length === 0) {
      throw new Error('Missing required parameters: retailerId, wholesalerId, items');
    }

    // 1. VALIDATE RETAILER
    const retailer = await prisma.retailer.findUnique({
      where: { id: retailerId }
    });

    if (!retailer) {
      throw new Error(`Retailer ${retailerId} not found`);
    }

    if (retailer.status === 'BLOCKED') {
      throw new Error('This retailer account is blocked');
    }

    // 2. VALIDATE WHOLESALER
    const wholesaler = await prisma.wholesaler.findUnique({
      where: { id: wholesalerId }
    });

    if (!wholesaler || !wholesaler.isActive) {
      throw new Error(`Wholesaler not found or inactive`);
    }

    // 3. CHECK CREDIT (if applicable)
    const paymentMode = options.paymentMode || 'COD';
    if (paymentMode === 'CREDIT') {
      // Check if credit is available
      const creditStatus = await creditService.getRetailerCreditStatus(retailerId, wholesalerId);
      if (!creditStatus.canPlaceOrder) {
        throw new Error(`Credit unavailable: ${creditStatus.reason}`);
      }
    }

    // 4. VALIDATE INVENTORY AVAILABILITY
    console.log(`🔍 Checking inventory for order...`);
    const inventoryValidation = await inventoryService.validateOrderAvailability(wholesalerId, items);

    if (!inventoryValidation.canFulfill) {
      const errors = inventoryValidation.errors.map(e => `• ${e}`).join('\n');
      const shortages = inventoryValidation.shortages
        .map(s => `• ${s.productName}: need ${s.shortage} more`)
        .join('\n');

      const errorMsg = [
        'Cannot fulfill order due to inventory issues:',
        ...(errors ? ['Errors:', errors] : []),
        ...(shortages ? ['Shortages:', shortages] : [])
      ].join('\n');

      throw new Error(errorMsg);
    }

    console.log(`✅ Inventory validated`);

    // 5. CALCULATE ORDER TOTAL
    const orderItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const wp = await prisma.wholesalerProduct.findUnique({
        where: {
          wholesalerId_productId: { wholesalerId, productId: item.productId }
        },
        include: { product: true }
      });

      if (!wp) {
        throw new Error(`Product not found for wholesaler: ${item.productId}`);
      }

      const lineTotal = parseFloat(wp.priceOffered || wp.product.fixedPrice) * item.quantity;
      totalAmount += lineTotal;

      orderItems.push({
        productId: item.productId,
        quantity: item.quantity,
        priceAtOrder: wp.priceOffered || wp.product.fixedPrice
      });
    }

    // 6. EXECUTE ATOMIC TRANSACTION: CREATE ORDER & RESERVE STOCK
    console.log(`🔒 Starting atomic order creation & stock reservation...`);

    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        // A. Create Order first (so we have ID for the reservation FK)
        const newOrder = await tx.order.create({
          data: {
            retailerId,
            wholesalerId,
            totalAmount: parseFloat(totalAmount),
            paymentMode,
            status: 'PLACED',
            items: {
              create: orderItems
            }
          },
          include: {
            items: { include: { product: true } },
            retailer: { select: { phoneNumber: true, pasalName: true } },
            wholesaler: { select: { businessName: true, whatsappNumber: true } }
          }
        });

        // B. Reserve Stock using the new Order ID (passing tx to ensure atomicity)
        const reservationResult = await inventoryService.reserveStock(
          newOrder.id,
          wholesalerId,
          items,
          tx
        );

        return { order: newOrder, reservations: reservationResult };
      }, {
        maxWait: 5000,
        timeout: 20000
      });

      console.log(`✅ Atomic transaction successful. Order: ${result.order.id}`);
    } catch (err) {
      console.error(`❌ Atomic transaction failed:`, err.message);
      throw new Error(`Order processing failed: ${err.message}`);
    }

    // Extract results
    const { order, reservations: reservation } = result;

    // 7. LOG THE ACTION (Non-blocking)
    prisma.auditLog.create({
      data: {
        retailerId,
        action: 'ORDER_CREATED',
        reference: order.id,
        newValue: JSON.stringify({
          wholesalerId,
          itemCount: items.length,
          totalAmount,
          paymentMode
        }),
        performedBy: 'SYSTEM'
      }
    }).catch(e => console.warn(`Warning: Failed to log order creation: ${e.message}`));

    return {
      order: {
        id: order.id,
        retailerId: order.retailerId,
        wholesalerId: order.wholesalerId,
        status: order.status,
        totalAmount: order.totalAmount,
        itemCount: order.items.length,
        items: order.items.map(i => ({
          productId: i.productId,
          productName: i.product.name,
          quantity: i.quantity,
          price: i.priceAtOrder
        })),
        createdAt: order.createdAt
      },
      stockStatus: {
        reserved: true,
        reservationCount: reservation.reservationCount,
        message: `${items.length} items reserved from ${wholesaler.businessName}`
      }
    };
  }

  /**
   * Cancel order and release reserved stock
   * 
   * @param {string} orderId
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelOrder(orderId, reason = 'User cancelled') {
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
      throw new Error(`Cannot cancel order with status ${order.status}`);
    }

    // Release reserved stock
    console.log(`🔓 Releasing reserved stock for order ${orderId}...`);
    try {
      const releaseResult = await inventoryService.releaseStock(orderId);
      console.log(`✅ Stock released`);
    } catch (err) {
      throw new Error(`Failed to release stock: ${err.message}`);
    }

    // Update order status
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        failureReason: reason,
        failedAt: new Date()
      },
      include: { items: true }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        retailerId: order.retailerId,
        action: 'ORDER_CANCELLED',
        reference: orderId,
        newValue: JSON.stringify({ status: 'CANCELLED', reason }),
        performedBy: 'SYSTEM'
      }
    }).catch(e => console.warn(`Warning: Failed to log cancellation: ${e.message}`));

    return {
      orderId,
      status: 'CANCELLED',
      message: `Order cancelled. Stock released: ${updated.items.length} items`
    };
  }

  /**
   * Confirm/Accept order (wholesaler accepts)
   * 
   * @param {string} orderId
   * @returns {Promise<Object>} Confirmed order
   */
  async confirmOrder(orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.status !== 'PLACED') {
      throw new Error(`Cannot confirm order with status ${order.status}`);
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date()
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        retailerId: order.retailerId,
        action: 'ORDER_CONFIRMED',
        reference: orderId,
        newValue: JSON.stringify({ status: 'CONFIRMED' }),
        performedBy: 'WHOLESALER'
      }
    }).catch(e => console.warn(`Warning: Failed to log confirmation: ${e.message}`));

    return {
      orderId,
      status: 'CONFIRMED',
      message: 'Order accepted by wholesaler'
    };
  }

  /**
   * Complete/Deliver order and deduct final stock
   * Supports partial fulfillment
   * 
   * @param {string} orderId
   * @param {Object} options - { partialQuantities: {reservationId: quantity} }
   * @returns {Promise<Object>} Delivery result
   */
  async completeOrder(orderId, options = {}) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (!['PLACED', 'CONFIRMED', 'IN_PROGRESS'].includes(order.status)) {
      throw new Error(`Cannot deliver order with status ${order.status}`);
    }

    // Deduct final stock
    console.log(`📦 Deducting stock for order ${orderId}...`);
    try {
      const deductResult = await inventoryService.deductStock(orderId, options);
      console.log(`✅ Stock deducted`);
    } catch (err) {
      throw new Error(`Failed to deduct stock: ${err.message}`);
    }

    // Update order status
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date()
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        retailerId: order.retailerId,
        action: 'ORDER_DELIVERED',
        reference: orderId,
        newValue: JSON.stringify({ status: 'DELIVERED' }),
        performedBy: 'WHOLESALER'
      }
    }).catch(e => console.warn(`Warning: Failed to log delivery: ${e.message}`));

    return {
      orderId,
      status: 'DELIVERED',
      message: `Order delivered. Stock deducted for ${order.items.length} items`
    };
  }

  /**
   * Get complete order with inventory status
   * 
   * @param {string} orderId
   * @returns {Promise<Object>} Order details with stock info
   */
  async getOrderWithInventory(orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
        retailer: { select: { phoneNumber: true, pasalName: true } },
        wholesaler: { select: { businessName: true } },
        stockReservations: {
          include: { wholesalerProduct: { include: { product: true } } }
        }
      }
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Map reservations to items
    const itemsWithInventory = order.items.map(item => ({
      ...item,
      inventory: order.stockReservations
        .filter(r => r.wholesalerProduct.productId === item.productId)
        .map(r => ({
          reserved: r.quantity,
          status: r.status
        }))
    }));

    return {
      order: {
        id: order.id,
        status: order.status,
        retailer: order.retailer,
        wholesaler: order.wholesaler,
        totalAmount: order.totalAmount,
        paymentMode: order.paymentMode,
        items: itemsWithInventory,
        createdAt: order.createdAt,
        confirmedAt: order.confirmedAt,
        deliveredAt: order.deliveredAt,
        cancelledAt: order.failedAt
      },
      inventory: {
        reservedItemCount: order.stockReservations.filter(r => r.status === 'ACTIVE').length,
        fulfilledItemCount: order.stockReservations.filter(r => r.status === 'FULFILLED').length,
        releasedItemCount: order.stockReservations.filter(r => r.status === 'RELEASED').length
      }
    };
  }
}

module.exports = new OrderServiceV2();
