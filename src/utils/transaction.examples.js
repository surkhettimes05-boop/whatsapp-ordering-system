/**
 * Transaction Framework - Usage Examples
 * 
 * This file demonstrates how to use the withTransaction utility
 * in various scenarios across the platform.
 */

const { withTransaction } = require('./transaction');
const prisma = require('../config/database');

// ============================================================================
// EXAMPLE 1: Order Creation
// ============================================================================

async function createOrderExample(retailerId, items) {
  return await withTransaction(async (tx) => {
    // Create order
    const order = await tx.order.create({
      data: {
        retailerId,
        totalAmount: calculateTotal(items),
        paymentMode: 'COD',
        status: 'PLACED'
      }
    });

    // Create order items
    await tx.orderItem.createMany({
      data: items.map(item => ({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        priceAtOrder: item.price
      }))
    });

    return order;
  }, {
    operation: 'ORDER_CREATION',
    entityId: null, // Will be set after order creation
    entityType: 'Order',
    timeout: 10000
  });
}

// ============================================================================
// EXAMPLE 2: Vendor Selection (Decision Engine)
// ============================================================================

async function selectVendorExample(orderId, winnerId) {
  return await withTransaction(async (tx) => {
    // Lock order row
    const order = await tx.$queryRaw`
      SELECT id, "final_wholesaler_id", status
      FROM "Order"
      WHERE id = ${orderId}
      FOR UPDATE
    `;

    if (order[0].final_wholesaler_id) {
      throw new Error('Order already has a winner');
    }

    // Update order
    await tx.order.update({
      where: { id: orderId },
      data: {
        final_wholesaler_id: winnerId,
        wholesalerId: winnerId,
        status: 'WHOLESALER_ACCEPTED'
      }
    });

    // Update vendor offer
    await tx.vendorOffer.update({
      where: {
        order_id_wholesaler_id: {
          order_id: orderId,
          wholesaler_id: winnerId
        }
      },
      data: { status: 'ACCEPTED' }
    });

    return { success: true };
  }, {
    operation: 'VENDOR_SELECTION',
    entityId: orderId,
    entityType: 'Order',
    timeout: 10000
  });
}

// ============================================================================
// EXAMPLE 3: Credit Debit Operation
// ============================================================================

async function createCreditDebitExample(orderId, amount) {
  return await withTransaction(async (tx) => {
    // Get order details
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { retailerId: true, wholesalerId: true }
    });

    if (!order.wholesalerId) {
      throw new Error('Order has no wholesaler assigned');
    }

    // Lock credit relationship
    await tx.$queryRaw`
      SELECT 1 FROM "RetailerWholesalerCredit"
      WHERE "retailerId" = ${order.retailerId} 
      AND "wholesalerId" = ${order.wholesalerId}
      FOR UPDATE
    `;

    // Get last balance
    const lastEntry = await tx.ledgerEntry.findFirst({
      where: {
        retailerId: order.retailerId,
        wholesalerId: order.wholesalerId
      },
      orderBy: { createdAt: 'desc' }
    });

    const currentBalance = lastEntry ? Number(lastEntry.balanceAfter) : 0;
    const newBalance = currentBalance + Number(amount);

    // Create debit entry
    const entry = await tx.ledgerEntry.create({
      data: {
        retailerId: order.retailerId,
        wholesalerId: order.wholesalerId,
        orderId: orderId,
        entryType: 'DEBIT',
        amount: amount,
        balanceAfter: newBalance,
        createdBy: 'SYSTEM'
      }
    });

    return entry;
  }, {
    operation: 'CREDIT_DEBIT',
    entityId: orderId,
    entityType: 'LedgerEntry',
    timeout: 10000
  });
}

// ============================================================================
// EXAMPLE 4: Stock Reservation
// ============================================================================

async function reserveStockExample(orderId, wholesalerId, items) {
  return await withTransaction(async (tx) => {
    for (const item of items) {
      // Lock wholesaler product
      const wp = await tx.wholesalerProduct.findUnique({
        where: {
          wholesalerId_productId: {
            wholesalerId,
            productId: item.productId
          }
        }
      });

      if (!wp) {
        throw new Error(`Product ${item.productId} not found`);
      }

      const available = wp.stock - wp.reservedStock;
      if (available < item.quantity) {
        throw new Error(`Insufficient stock. Available: ${available}, Requested: ${item.quantity}`);
      }

      // Reserve stock
      await tx.wholesalerProduct.update({
        where: { id: wp.id },
        data: {
          reservedStock: { increment: item.quantity }
        }
      });

      // Create reservation record
      await tx.stockReservation.create({
        data: {
          wholesalerProductId: wp.id,
          orderId: orderId,
          quantity: item.quantity,
          status: 'ACTIVE'
        }
      });
    }

    return { success: true, itemsReserved: items.length };
  }, {
    operation: 'STOCK_RESERVATION',
    entityId: orderId,
    entityType: 'Order',
    timeout: 10000
  });
}

// ============================================================================
// EXAMPLE 5: Admin Override - Force Select Vendor
// ============================================================================

async function adminForceSelectVendorExample(adminId, orderId, wholesalerId, reason) {
  return await withTransaction(async (tx) => {
    // Validate order
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        retailer: true
      }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
      throw new Error(`Cannot modify order with status ${order.status}`);
    }

    // Release existing reservations
    const existingReservations = await tx.stockReservation.findMany({
      where: { orderId, status: 'ACTIVE' }
    });

    for (const res of existingReservations) {
      await tx.wholesalerProduct.update({
        where: { id: res.wholesalerProductId },
        data: { reservedStock: { decrement: res.quantity } }
      });
      await tx.stockReservation.update({
        where: { id: res.id },
        data: { status: 'RELEASED' }
      });
    }

    // Reserve stock for new vendor
    for (const item of order.items) {
      const wp = await tx.wholesalerProduct.findUnique({
        where: {
          wholesalerId_productId: {
            wholesalerId,
            productId: item.productId
          }
        }
      });

      if (!wp || (wp.stock - wp.reservedStock) < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }

      await tx.wholesalerProduct.update({
        where: { id: wp.id },
        data: { reservedStock: { increment: item.quantity } }
      });

      await tx.stockReservation.create({
        data: {
          wholesalerProductId: wp.id,
          orderId: orderId,
          quantity: item.quantity,
          status: 'ACTIVE'
        }
      });
    }

    // Update order
    await tx.order.update({
      where: { id: orderId },
      data: {
        final_wholesaler_id: wholesalerId,
        wholesalerId: wholesalerId,
        status: 'WHOLESALER_ACCEPTED'
      }
    });

    // Update vendor offer
    await tx.vendorOffer.update({
      where: {
        order_id_wholesaler_id: {
          order_id: orderId,
          wholesaler_id: wholesalerId
        }
      },
      data: { status: 'ACCEPTED' }
    });

    // Log admin action (outside transaction)
    await prisma.adminAuditLog.create({
      data: {
        adminId,
        action: 'FORCE_SELECT_VENDOR',
        targetId: orderId,
        reason: reason
      }
    });

    return { success: true };
  }, {
    operation: 'ADMIN_FORCE_SELECT_VENDOR',
    entityId: orderId,
    entityType: 'Order',
    timeout: 15000
  });
}

// ============================================================================
// EXAMPLE 6: Complex Multi-Step Operation
// ============================================================================

async function completeOrderFlowExample(orderId, wholesalerId) {
  return await withTransaction(async (tx) => {
    // Step 1: Lock and validate order
    const order = await tx.$queryRaw`
      SELECT id, "retailerId", "totalAmount", status
      FROM "Order"
      WHERE id = ${orderId}
      FOR UPDATE
    `;

    if (order[0].status !== 'WHOLESALER_ACCEPTED') {
      throw new Error(`Invalid order status: ${order[0].status}`);
    }

    // Step 2: Reserve stock
    const items = await tx.orderItem.findMany({
      where: { orderId }
    });

    for (const item of items) {
      const wp = await tx.wholesalerProduct.findUnique({
        where: {
          wholesalerId_productId: {
            wholesalerId,
            productId: item.productId
          }
        }
      });

      await tx.wholesalerProduct.update({
        where: { id: wp.id },
        data: { reservedStock: { increment: item.quantity } }
      });
    }

    // Step 3: Create ledger entry
    const lastEntry = await tx.ledgerEntry.findFirst({
      where: {
        retailerId: order[0].retailerId,
        wholesalerId: wholesalerId
      },
      orderBy: { createdAt: 'desc' }
    });

    const currentBalance = lastEntry ? Number(lastEntry.balanceAfter) : 0;
    const newBalance = currentBalance + Number(order[0].totalAmount);

    await tx.ledgerEntry.create({
      data: {
        retailerId: order[0].retailerId,
        wholesalerId: wholesalerId,
        orderId: orderId,
        entryType: 'DEBIT',
        amount: order[0].totalAmount,
        balanceAfter: newBalance,
        createdBy: 'SYSTEM'
      }
    });

    // Step 4: Update order
    await tx.order.update({
      where: { id: orderId },
      data: {
        final_wholesaler_id: wholesalerId,
        wholesalerId: wholesalerId,
        status: 'WHOLESALER_ACCEPTED'
      }
    });

    return { success: true };
  }, {
    operation: 'COMPLETE_ORDER_FLOW',
    entityId: orderId,
    entityType: 'Order',
    timeout: 15000
  });
}

// Helper function
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

module.exports = {
  createOrderExample,
  selectVendorExample,
  createCreditDebitExample,
  reserveStockExample,
  adminForceSelectVendorExample,
  completeOrderFlowExample
};
