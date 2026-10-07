const prisma = require('../config/database');
async function reserve(tx, order, items) {
  const location = process.env.COMMERCE_WHOLESALER_ID;
  if (!location) throw new Error('Fulfillment inventory is not configured');
  const store = await tx.wholesaler.findUnique({ where: { id: location } });
  if (!store?.isActive || store.deletedAt) throw new Error('Fulfillment location is closed');
  for (const item of [...items].sort((a,b) => a.productId.localeCompare(b.productId))) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) throw new Error('Invalid quantity');
    const rows = await tx.$queryRaw`SELECT * FROM wholesaler_products WHERE "wholesalerId" = ${location} AND "productId" = ${item.productId} FOR UPDATE`;
    const row = rows[0];
    if (!row || !row.isAvailable || row.stock - row.reservedStock < item.quantity) throw new Error(`Insufficient stock for ${item.product?.name || item.productId}`);
    await tx.wholesalerProduct.update({ where: { id: row.id }, data: { reservedStock: { increment: item.quantity } } });
    const reservation = await tx.stockReservation.create({ data: { orderId: order.id, wholesalerProductId: row.id, quantity: item.quantity } });
    await tx.commerceInventoryEvent.create({ data: { inventoryId: row.id, orderId: order.id, kind: 'RESERVE', quantity: item.quantity, physicalDelta: 0, reservedDelta: item.quantity, reference: reservation.id + ':RESERVE' } });
  }
  await tx.order.update({ where: { id: order.id }, data: { wholesalerId: location } });
}
async function settle(tx, order, kind, actorId) {
  const reservations = await tx.stockReservation.findMany({ where: { orderId: order.id, status: 'ACTIVE' }, orderBy: { wholesalerProductId: 'asc' } });
  if (!reservations.length) throw new Error('Order has no active inventory reservation; reconcile this order before proceeding');
  for (const reservation of reservations) {
    const rows = await tx.$queryRaw`SELECT * FROM wholesaler_products WHERE id = ${reservation.wholesalerProductId} FOR UPDATE`;
    const row = rows[0];
    if (!row || row.reservedStock < reservation.quantity || row.stock < row.reservedStock) throw new Error('Inventory reconciliation required');
    const fulfill = kind === 'FULFILL';
    await tx.wholesalerProduct.update({ where: { id: row.id }, data: { reservedStock: { decrement: reservation.quantity }, ...(fulfill ? { stock: { decrement: reservation.quantity } } : {}) } });
    await tx.stockReservation.update({ where: { id: reservation.id }, data: { status: fulfill ? 'FULFILLED' : 'RELEASED' } });
    await tx.commerceInventoryEvent.create({ data: { inventoryId: row.id, orderId: order.id, kind, quantity: reservation.quantity, physicalDelta: fulfill ? -reservation.quantity : 0, reservedDelta: -reservation.quantity, reference: reservation.id + ':' + kind, actorId } });
  }
}
async function receiveStock(productId, quantity, reference, actorId) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || !reference || reference.length > 120) throw new Error('Positive integer quantity and receipt reference required');
  const location = process.env.COMMERCE_WHOLESALER_ID;
  if (!location) throw new Error('Fulfillment inventory is not configured');
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${location + ':' + productId}))`;
    const prior = await tx.commerceInventoryEvent.findUnique({ where: { reference: 'RECEIPT:' + reference } });
    if (prior) {
      const inventory = await tx.wholesalerProduct.findUnique({ where: { id: prior.inventoryId } });
      if (inventory.productId !== productId || prior.quantity !== quantity) throw new Error('Receipt reference was used for different stock');
      return inventory;
    }
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive || product.deletedAt) throw new Error('Product unavailable');
    const row = await tx.wholesalerProduct.upsert({ where: { wholesalerId_productId: { wholesalerId: location, productId } }, create: { wholesalerId: location, productId, priceOffered: product.fixedPrice, stock: quantity }, update: { stock: { increment: quantity }, isAvailable: true } });
    await tx.commerceInventoryEvent.create({ data: { inventoryId: row.id, kind: 'RECEIPT', quantity, physicalDelta: quantity, reservedDelta: 0, reference: 'RECEIPT:' + reference, actorId } });
    return row;
  });
}
module.exports = { reserve, settle, receiveStock };
