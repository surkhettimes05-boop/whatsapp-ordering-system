const prisma = require('../config/database');

/**
 * Comprehensive Inventory Management Service
 * 
 * Truth Layer: WholesalerProduct tracks physical stock
 * - stock: Actual quantity available for sale
 * - reservedStock: Quantity locked for active orders
 * - availableStock: stock - reservedStock
 * 
 * Reservations: StockReservation tracks per-order inventory holds
 * - ACTIVE: Order in progress, stock is held
 * - RELEASED: Order cancelled, stock released back
 * - FULFILLED: Order delivered, stock deducted
 */
class InventoryService {
  /**
   * Get available stock for a product at a wholesaler
   * Available = Physical - Reserved
   * 
   * @param {string} wholesalerId
   * @param {string} productId
   * @returns {Promise<number>} Available quantity
   */
  async getAvailableStock(wholesalerId, productId) {
    const wp = await prisma.wholesalerProduct.findUnique({
      where: {
        wholesalerId_productId: { wholesalerId, productId }
      }
    });

    if (!wp) return 0;

    return wp.stock - wp.reservedStock;
  }

  /**
   * Get detailed inventory status for a product
   * 
   * @param {string} wholesalerId
   * @param {string} productId
   * @returns {Promise<Object>} Inventory details
   */
  async getInventoryStatus(wholesalerId, productId) {
    const wp = await prisma.wholesalerProduct.findUnique({
      where: {
        wholesalerId_productId: { wholesalerId, productId }
      },
      include: {
        product: true,
        reservations: {
          where: { status: 'ACTIVE' },
          include: { order: { select: { id: true, retailerId: true } } }
        }
      }
    });

    if (!wp) {
      return {
        available: false,
        reason: 'Product not available at this wholesaler'
      };
    }

    const available = wp.stock - wp.reservedStock;
    const activeReservations = wp.reservations.length;

    return {
      wholesalerId,
      productId,
      productName: wp.product.name,
      physicalStock: wp.stock,
      reservedStock: wp.reservedStock,
      availableStock: available,
      activeReservations,
      isAvailable: available > 0 && wp.isAvailable,
      lastUpdated: wp.updatedAt
    };
  }

  /**
   * Check if a wholesaler can fulfill entire order
   * Validates that all items are available with sufficient quantity
   * 
   * @param {string} wholesalerId
   * @param {Array<{productId: string, quantity: number}>} items
   * @returns {Promise<{canFulfill: boolean, shortages: Array, errors: Array}>}
   */
  async validateOrderAvailability(wholesalerId, items) {
    const result = {
      canFulfill: true,
      shortages: [],
      errors: []
    };

    if (!items || items.length === 0) {
      result.errors.push('No items in order');
      result.canFulfill = false;
      return result;
    }

    for (const item of items) {
      try {
        const wp = await prisma.wholesalerProduct.findUnique({
          where: {
            wholesalerId_productId: { wholesalerId, productId: item.productId }
          },
          include: { product: true }
        });

        if (!wp) {
          result.errors.push(`Product ${item.productId} not available at this wholesaler`);
          result.canFulfill = false;
          continue;
        }

        const available = wp.stock - wp.reservedStock;
        if (available < item.quantity) {
          result.shortages.push({
            productId: item.productId,
            productName: wp.product.name,
            requested: item.quantity,
            available,
            shortage: item.quantity - available
          });
          result.canFulfill = false;
        }

        if (!wp.isAvailable) {
          result.errors.push(`Product ${wp.product.name} is currently unavailable`);
          result.canFulfill = false;
        }
      } catch (err) {
        result.errors.push(`Error checking product ${item.productId}: ${err.message}`);
        result.canFulfill = false;
      }
    }

    return result;
  }

  /**
   * Reserve stock for an order
   * ATOMIC TRANSACTION: All items reserved or none
   * 
   * Must call this before confirming order!
   * 
   * @param {string} orderId
   * @param {string} wholesalerId
   * @param {Array<{productId: string, quantity: number}>} items
   * @returns {Promise<Object>} Reservation details
   * @throws {Error} If stock unavailable or transaction fails
   */
  async reserveStock(orderId, wholesalerId, items, externalPrisma = null) {
    if (!orderId || !wholesalerId || !items || items.length === 0) {
      throw new Error('Invalid parameters for stock reservation');
    }

    // First validate availability (read-only check, can be outside tx usually, 
    // but if strict consistency is needed, we could pass tx here too. 
    // For now keeping it simple as it's a pre-check)
    const validation = await this.validateOrderAvailability(wholesalerId, items);
    if (!validation.canFulfill) {
      const errorMsg = validation.errors.length > 0
        ? `Cannot fulfill order: ${validation.errors[0]}`
        : `Stock shortage: ${validation.shortages.map(s => `${s.productName} (need ${s.shortage} more)`).join(', ')}`;
      throw new Error(errorMsg);
    }

    const reservations = [];

    const operation = async (tx) => {
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
          throw new Error(
            `Insufficient stock for product ${item.productId}. ` +
            `Requested: ${item.quantity}, Available: ${available}`
          );
        }

        // Increment reserved stock
        const updated = await tx.wholesalerProduct.update({
          where: { id: wp.id },
          data: {
            reservedStock: { increment: item.quantity }
          }
        });

        // Create reservation record
        const reservation = await tx.stockReservation.create({
          data: {
            wholesalerProductId: wp.id,
            orderId,
            quantity: item.quantity,
            status: 'ACTIVE'
          }
        });

        reservations.push({
          reservationId: reservation.id,
          productId: item.productId,
          quantity: item.quantity,
          status: 'ACTIVE'
        });
      }

      return reservations;
    };

    try {
      // Execute reservation in transaction (use external or create new)
      const result = externalPrisma
        ? await operation(externalPrisma)
        : await prisma.$transaction(operation);

      console.log(`✅ Stock reserved for order ${orderId}: ${reservations.length} items`);
      return {
        orderId,
        wholesalerId,
        reservationCount: reservations.length,
        reservations,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`❌ Stock reservation failed for order ${orderId}:`, error.message);
      throw error;
    }
  }

  /**
   * Release reserved stock (e.g., order cancelled or re-routed)
   * ATOMIC: All reservations released or none
   * 
   * @param {string} orderId
   * @returns {Promise<Object>} Release details
   */
  async releaseStock(orderId) {
    if (!orderId) {
      throw new Error('Order ID required for stock release');
    }

    const activeReservations = await prisma.stockReservation.findMany({
      where: { orderId, status: 'ACTIVE' },
      include: { wholesalerProduct: true }
    });

    if (activeReservations.length === 0) {
      console.warn(`⚠️ No active reservations found for order ${orderId}`);
      return {
        orderId,
        releasedCount: 0,
        reservations: []
      };
    }

    try {
      const released = await prisma.$transaction(async (tx) => {
        const releasedItems = [];

        for (const res of activeReservations) {
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
            data: { status: 'RELEASED', updatedAt: new Date() }
          });

          releasedItems.push({
            reservationId: res.id,
            productId: res.wholesalerProduct.productId,
            quantity: res.quantity
          });
        }

        return releasedItems;
      });

      console.log(`✅ Stock released for order ${orderId}: ${released.length} items`);
      return {
        orderId,
        releasedCount: released.length,
        reservations: released,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`❌ Stock release failed for order ${orderId}:`, error.message);
      throw error;
    }
  }

  /**
   * Finalize stock deduction (order delivered/completed)
   * Moves stock from Reserved → Deducted (physical inventory decreases)
   * 
   * ATOMIC: All items deducted or none
   * 
   * @param {string} orderId
   * @param {Object} options - { partialQuantities: {reservationId: quantity} } for partial fulfillment
   * @returns {Promise<Object>} Deduction details
   */
  async deductStock(orderId, options = {}) {
    if (!orderId) {
      throw new Error('Order ID required for stock deduction');
    }

    const activeReservations = await prisma.stockReservation.findMany({
      where: { orderId, status: 'ACTIVE' },
      include: { wholesalerProduct: { select: { productId: true } } }
    });

    if (activeReservations.length === 0) {
      console.warn(`⚠️ No active reservations found to deduct for order ${orderId}`);
      return {
        orderId,
        deductedCount: 0,
        reservations: []
      };
    }

    try {
      const deducted = await prisma.$transaction(async (tx) => {
        const deductedItems = [];

        for (const res of activeReservations) {
          // Support partial fulfillment
          const quantityToDeduct = options.partialQuantities?.[res.id] || res.quantity;

          if (quantityToDeduct < 0 || quantityToDeduct > res.quantity) {
            throw new Error(
              `Invalid deduction quantity ${quantityToDeduct} for reservation ${res.id} (max ${res.quantity})`
            );
          }

          // Deduct from both stock and reservedStock
          await tx.wholesalerProduct.update({
            where: { id: res.wholesalerProductId },
            data: {
              stock: { decrement: quantityToDeduct },
              reservedStock: { decrement: quantityToDeduct }
            }
          });

          // Update reservation status
          const newStatus = quantityToDeduct === res.quantity ? 'FULFILLED' : 'PARTIALLY_FULFILLED';
          await tx.stockReservation.update({
            where: { id: res.id },
            data: {
              status: newStatus,
              quantity: quantityToDeduct, // Update to actual deducted quantity
              updatedAt: new Date()
            }
          });

          deductedItems.push({
            reservationId: res.id,
            productId: res.wholesalerProduct.productId,
            quantityDeducted: quantityToDeduct,
            quantityReserved: res.quantity,
            isPartial: quantityToDeduct < res.quantity
          });
        }

        return deductedItems;
      });

      console.log(`✅ Stock deducted for order ${orderId}: ${deducted.length} items`);
      return {
        orderId,
        deductedCount: deducted.length,
        reservations: deducted,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`❌ Stock deduction failed for order ${orderId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get inventory history for debugging/auditing
   * 
   * @param {string} wholesalerId
   * @param {string} productId
   * @returns {Promise<Object>} Inventory audit trail
   */
  async getInventoryAudit(wholesalerId, productId) {
    const [wp, reservations, orders] = await Promise.all([
      prisma.wholesalerProduct.findUnique({
        where: { wholesalerId_productId: { wholesalerId, productId } },
        include: { product: true }
      }),
      prisma.stockReservation.findMany({
        where: {
          wholesalerProduct: { wholesalerId, productId }
        },
        include: {
          order: { select: { id: true, status: true, createdAt: true } }
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    if (!wp) {
      throw new Error(`Product ${productId} not found for wholesaler ${wholesalerId}`);
    }

    return {
      product: {
        id: wp.productId,
        name: wp.product.name
      },
      wholesaler: { id: wholesalerId },
      currentStock: {
        physical: wp.stock,
        reserved: wp.reservedStock,
        available: wp.stock - wp.reservedStock
      },
      reservations: reservations.map(r => ({
        reservationId: r.id,
        orderId: r.orderId,
        quantity: r.quantity,
        status: r.status,
        orderStatus: r.order.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      })),
      lastUpdated: wp.updatedAt
    };
  }

  /**
   * Negative stock guard - should never happen if system works correctly
   * Use this for auditing and fixing data issues
   * 
   * @returns {Promise<Array>} List of inventory issues
   */
  async detectNegativeStock() {
    const issues = [];

    const products = await prisma.wholesalerProduct.findMany({
      include: { product: true, wholesaler: true }
    });

    for (const wp of products) {
      if (wp.stock < 0) {
        issues.push({
          type: 'NEGATIVE_PHYSICAL_STOCK',
          wholesaler: wp.wholesaler.businessName,
          product: wp.product.name,
          stock: wp.stock,
          reserved: wp.reservedStock
        });
      }

      if (wp.reservedStock < 0) {
        issues.push({
          type: 'NEGATIVE_RESERVED_STOCK',
          wholesaler: wp.wholesaler.businessName,
          product: wp.product.name,
          stock: wp.stock,
          reserved: wp.reservedStock
        });
      }

      if (wp.reservedStock > wp.stock) {
        issues.push({
          type: 'RESERVED_EXCEEDS_PHYSICAL',
          wholesaler: wp.wholesaler.businessName,
          product: wp.product.name,
          stock: wp.stock,
          reserved: wp.reservedStock
        });
      }
    }

    return issues;
  }
}

module.exports = new InventoryService();
