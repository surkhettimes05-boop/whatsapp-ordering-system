const prisma = require('../config/database');
const { withTransaction } = require('../utils/transaction');

/**
 * Service to manage inventory truth layer
 * Handles reservation, release, and deduction of stock
 */
class StockService {

    /**
     * Check if a wholesaler has enough available stock (Physical - Reserved)
     * @param {string} wholesalerId 
     * @param {Array<{productId: string, quantity: number}>} items 
     * @returns {Promise<boolean>}
     */
    async checkAvailability(wholesalerId, items) {
        for (const item of items) {
            const wp = await prisma.wholesalerProduct.findUnique({
                where: {
                    wholesalerId_productId: {
                        wholesalerId,
                        productId: item.productId
                    }
                }
            });

            if (!wp) return false;

            const available = wp.stock - wp.reservedStock;
            if (available < item.quantity) {
                return false;
            }
        }
        return true;
    }

    /**
     * Reserve stock for an order.
     * MUST be called within a transaction if possible, or handles its own transaction.
     * throws Error if sufficient stock is not available.
     * @param {string} orderId 
     * @param {string} wholesalerId 
     * @param {Array<{productId: string, quantity: number}>} items 
     */
    async reserveStock(orderId, wholesalerId, items) {
        return withTransaction(async (tx) => {
            // 1. Verify and Lock Stock
            for (const item of items) {
                const wp = await tx.wholesalerProduct.findUnique({
                    where: {
                        wholesalerId_productId: { wholesalerId, productId: item.productId }
                    }
                });

                if (!wp) {
                    throw new Error(`Product ${item.productId} not found for wholesaler ${wholesalerId}`);
                }

                const available = wp.stock - wp.reservedStock;
                if (available < item.quantity) {
                    throw new Error(`Insufficient stock for product ${item.productId}. Requested: ${item.quantity}, Available: ${available}`);
                }

                // 2. Increment Reserved Stock
                await tx.wholesalerProduct.update({
                    where: { id: wp.id },
                    data: {
                        reservedStock: { increment: item.quantity }
                    }
                });

                // 3. Create Reservation Record
                await tx.stockReservation.create({
                    data: {
                        wholesalerProductId: wp.id,
                        orderId: orderId,
                        quantity: item.quantity,
                        status: 'ACTIVE'
                    }
                });
            }
        });
    }

    /**
     * Release reserved stock (e.g. on Cancellation or Re-routing)
     * @param {string} orderId 
     */
    async releaseStock(orderId) {
        const reservations = await prisma.stockReservation.findMany({
            where: { orderId, status: 'ACTIVE' }
        });

        if (reservations.length === 0) return;

        return prisma.$transaction(async (tx) => {
            for (const res of reservations) {
                // Decrement reserved stock
                await tx.wholesalerProduct.update({
                    where: { id: res.wholesalerProductId },
                    data: {
                        reservedStock: { decrement: res.quantity }
                    }
                });

                // Mark reservation as released
                await tx.stockReservation.update({
                    where: { id: res.id },
                    data: { status: 'RELEASED' }
                });
            }
        });
    }

    /**
     * Finalize stock deduction (e.g. on Delivery)
     * Moves stock from Reserved to Deducted (Physical stock decreases)
     * @param {string} orderId 
     */
    async deductStock(orderId) {
        const reservations = await prisma.stockReservation.findMany({
            where: { orderId, status: 'ACTIVE' }
        });

        // Note: If no reservations found, it might be an older order or already deducted.
        // We should proceed carefully. 
        if (reservations.length === 0) {
            console.warn(`No active reservations found for deduplication for order ${orderId}`);
            return;
        }

        return withTransaction(async (tx) => {
            for (const res of reservations) {
                // Update Inventory: Remove from Stock AND Reserved
                // stock -= qty
                // reservedStock -= qty
                await tx.wholesalerProduct.update({
                    where: { id: res.wholesalerProductId },
                    data: {
                        stock: { decrement: res.quantity },
                        reservedStock: { decrement: res.quantity }
                    }
                });

                // Mark reservation as fulfilled
                await tx.stockReservation.update({
                    where: { id: res.id },
                    data: { status: 'FULFILLED' }
                });
            }
        }, {
            operation: 'STOCK_DEDUCTION',
            entityId: orderId,
            entityType: 'Order',
            timeout: 10000
        });
    }
}

module.exports = new StockService();
