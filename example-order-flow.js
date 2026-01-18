const { PrismaClient } = require('@prisma/client');
const { runSerializableTransaction } = require('./transaction');
const { logger } = require('./src/config/logger');

const prisma = new PrismaClient();

/**
 * Example order flow that demonstrates using the transaction wrapper to:
 * - create order
 * - assign vendor
 * - debit credit
 * - reserve stock
 */
async function createAndReserveOrder(examplePayload) {
  return runSerializableTransaction(prisma, async (tx) => {
    // 1) Create order and items
    const order = await tx.order.create({
      data: {
        retailerId: examplePayload.retailerId,
        totalAmount: examplePayload.totalAmount,
        paymentMode: examplePayload.paymentMode || 'CREDIT',
        status: 'PENDING',
        items: {
          create: examplePayload.items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            priceAtOrder: it.price
          }))
        }
      },
      include: { items: true }
    });

    // 2) Assign vendor (simple routing: pick supplied wholesalerId)
    if (examplePayload.wholesalerId) {
      await tx.order.update({ where: { id: order.id }, data: { wholesalerId: examplePayload.wholesalerId } });
    }

    // 3) Debit credit (update CreditAccount and create ledger entry)
    if (order.paymentMode === 'CREDIT') {
      const credit = await tx.creditAccount.findUnique({ where: { retailerId: order.retailerId } });
      if (!credit) throw new Error('Credit account not found');

      const newUsed = Number(credit.usedCredit) + Number(order.totalAmount);
      await tx.creditAccount.update({ where: { retailerId: order.retailerId }, data: { usedCredit: newUsed } });

      await tx.ledgerEntry.create({
        data: {
          retailerId: order.retailerId,
          wholesalerId: examplePayload.wholesalerId || '',
          orderId: order.id,
          entryType: 'DEBIT',
          amount: order.totalAmount,
          balanceAfter: newUsed,
          createdBy: 'system'
        }
      });
    }

    // 4) Reserve stock for each item
    for (const item of order.items) {
      const wp = await tx.wholesalerProduct.findUnique({ where: { id: examplePayload.productToWholesalerMap[item.productId] } });
      if (!wp) throw new Error('WholesalerProduct not found');
      if (wp.stock - wp.reservedStock < item.quantity) throw new Error('Insufficient stock');

      await tx.wholesalerProduct.update({ where: { id: wp.id }, data: { reservedStock: { increment: item.quantity }, stock: { decrement: item.quantity } } });

      await tx.stockReservation.create({ data: { wholesalerProductId: wp.id, orderId: order.id, quantity: item.quantity } });
    }

    logger.info('Order created and reserved within transaction', { orderId: order.id });
    return order;
  });
}

module.exports = {
  createAndReserveOrder,
};

// If run directly, demonstrate usage (requires env DATABASE_URL)
if (require.main === module) {
  (async () => {
    try {
      const demo = await createAndReserveOrder({
        retailerId: 'RETAILER_ID',
        wholesalerId: 'WHOLESALER_ID',
        totalAmount: 100,
        paymentMode: 'CREDIT',
        items: [{ productId: 'PRODUCT_ID', quantity: 1, price: 100 }],
        productToWholesalerMap: { 'PRODUCT_ID': 'WHOLESALER_PRODUCT_ID' }
      });
      console.log('Demo order:', demo.id);
    } catch (err) {
      console.error('Demo failed', err);
    } finally {
      await prisma.$disconnect();
    }
  })();
}
