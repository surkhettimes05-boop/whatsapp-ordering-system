const prisma = require('../config/database');
const geolib = require('geolib');

/**
 * Finds eligible wholesalers for a given order based on location, product availability, and active status.
 *
 * @param {object} order The order object, including items and retailer location.
 * @returns {Promise<import('@prisma/client').Wholesaler[]>} A list of eligible wholesalers.
 */
async function getEligibleWholesalers(order) {
  const { retailer, items } = order;
  if (!retailer || !retailer.latitude || !retailer.longitude) {
    // Cannot perform distance-based search without retailer location
    return [];
  }

  const productIds = items.map((item) => item.productId);
  if (productIds.length === 0) {
    return [];
  }

  // 1. Fetch wholesalers who are active and carry at least one of the requested products
  // We'll filter for ALL products after this to ensure full compatibility
  const candidates = await prisma.wholesaler.findMany({
    where: {
      isActive: true,
      products: {
        some: {
          productId: { in: productIds },
          isAvailable: true,
          stock: { gt: 0 }
        }
      }
    },
    include: {
      products: {
        where: {
          productId: { in: productIds },
          isAvailable: true,
          stock: { gt: 0 }
        }
      }
    }
  });

  // 2. Filter by Product Availability (Wholesaler must have ALL requested products in sufficient quantity)
  // and by Location Radius (within wholesaler's deliveryRadius)
  const eligible = candidates.filter(wholesaler => {
    // Check if wholesaler has ALL requested products with enough stock
    const hasAllProducts = items.every(item => {
      const wp = wholesaler.products.find(p => p.productId === item.productId);
      return wp && wp.stock >= item.quantity;
    });

    if (!hasAllProducts) return false;

    // Check distance using geolib
    if (!wholesaler.latitude || !wholesaler.longitude) return false;

    const distanceMeters = geolib.getDistance(
      { latitude: retailer.latitude, longitude: retailer.longitude },
      { latitude: wholesaler.latitude, longitude: wholesaler.longitude }
    );
    const distanceKm = distanceMeters / 1000;

    // Default to 50km if deliveryRadius is not set
    const maxRadius = wholesaler.deliveryRadius || 50;

    return distanceKm <= maxRadius;
  });

  return eligible;
}

module.exports = {
  getEligibleWholesalers,
};
