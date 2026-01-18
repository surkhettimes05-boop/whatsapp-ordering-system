const prisma = require('../config/database');

/**
 * Analytics Service
 * Provides analytics queries for order and wholesaler performance metrics
 */
class AnalyticsService {
  /**
   * Get offer count per order
   * @param {object} filters - Optional filters { orderId, status, dateRange }
   * @returns {Promise<Array>} Array of orders with offer counts
   */
  async getOfferCountPerOrder(filters = {}) {
    const where = {};
    
    if (filters.orderId) {
      where.id = filters.orderId;
    }
    
    if (filters.status) {
      where.status = filters.status;
    }
    
    if (filters.dateRange) {
      where.createdAt = {
        gte: filters.dateRange.start,
        lte: filters.dateRange.end
      };
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        vendorOffers: {
          select: {
            id: true,
            status: true,
            created_at: true
          }
        },
        retailer: {
          select: {
            id: true,
            pasalName: true,
            phoneNumber: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 100
    });

    return orders.map(order => ({
      orderId: order.id,
      orderStatus: order.status,
      createdAt: order.createdAt,
      expiresAt: order.expires_at,
      retailer: {
        id: order.retailer.id,
        name: order.retailer.pasalName || order.retailer.phoneNumber
      },
      totalOffers: order.vendorOffers.length,
      offersByStatus: {
        PENDING: order.vendorOffers.filter(o => o.status === 'PENDING').length,
        ACCEPTED: order.vendorOffers.filter(o => o.status === 'ACCEPTED').length,
        REJECTED: order.vendorOffers.filter(o => o.status === 'REJECTED').length,
        EXPIRED: order.vendorOffers.filter(o => o.status === 'EXPIRED').length
      },
      offers: order.vendorOffers.map(offer => ({
        id: offer.id,
        status: offer.status,
        submittedAt: offer.created_at
      }))
    }));
  }

  /**
   * Get average response time for offers
   * Response time = time between order creation and offer submission
   * @param {object} filters - Optional filters { wholesalerId, dateRange }
   * @returns {Promise<object>} Average response time statistics
   */
  async getAverageResponseTime(filters = {}) {
    const where = {};
    
    if (filters.dateRange) {
      where.created_at = {
        gte: filters.dateRange.start,
        lte: filters.dateRange.end
      };
    }

    if (filters.wholesalerId) {
      where.wholesaler_id = filters.wholesalerId;
    }

    // Get all offers with their order creation times
    const offers = await prisma.vendorOffer.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            createdAt: true
          }
        }
      }
    });

    if (offers.length === 0) {
      return {
        totalOffers: 0,
        averageResponseTimeMinutes: 0,
        averageResponseTimeHours: 0,
        medianResponseTimeMinutes: 0,
        minResponseTimeMinutes: 0,
        maxResponseTimeMinutes: 0,
        responseTimeDistribution: {
          under5min: 0,
          under15min: 0,
          under30min: 0,
          under1hour: 0,
          over1hour: 0
        }
      };
    }

    // Calculate response times in minutes
    const responseTimes = offers.map(offer => {
      const orderCreated = new Date(offer.order.createdAt);
      const offerSubmitted = new Date(offer.created_at);
      const diffMs = offerSubmitted.getTime() - orderCreated.getTime();
      return Math.max(0, diffMs / (1000 * 60)); // Convert to minutes
    });

    // Calculate statistics
    const total = responseTimes.length;
    const sum = responseTimes.reduce((acc, time) => acc + time, 0);
    const averageMinutes = sum / total;
    const sorted = [...responseTimes].sort((a, b) => a - b);
    const medianMinutes = sorted[Math.floor(sorted.length / 2)];
    const minMinutes = Math.min(...responseTimes);
    const maxMinutes = Math.max(...responseTimes);

    // Distribution
    const distribution = {
      under5min: responseTimes.filter(t => t < 5).length,
      under15min: responseTimes.filter(t => t < 15).length,
      under30min: responseTimes.filter(t => t < 30).length,
      under1hour: responseTimes.filter(t => t < 60).length,
      over1hour: responseTimes.filter(t => t >= 60).length
    };

    return {
      totalOffers: total,
      averageResponseTimeMinutes: Math.round(averageMinutes * 100) / 100,
      averageResponseTimeHours: Math.round((averageMinutes / 60) * 100) / 100,
      medianResponseTimeMinutes: Math.round(medianMinutes * 100) / 100,
      minResponseTimeMinutes: Math.round(minMinutes * 100) / 100,
      maxResponseTimeMinutes: Math.round(maxMinutes * 100) / 100,
      responseTimeDistribution: {
        under5min: distribution.under5min,
        under15min: distribution.under15min,
        under30min: distribution.under30min,
        under1hour: distribution.under1hour,
        over1hour: distribution.over1hour
      }
    };
  }

  /**
   * Get win rate per wholesaler
   * Win rate = (ACCEPTED offers) / (Total offers) * 100
   * @param {object} filters - Optional filters { wholesalerId, dateRange }
   * @returns {Promise<Array>} Array of wholesalers with win rate statistics
   */
  async getWinRatePerWholesaler(filters = {}) {
    const where = {};
    
    if (filters.dateRange) {
      where.created_at = {
        gte: filters.dateRange.start,
        lte: filters.dateRange.end
      };
    }

    if (filters.wholesalerId) {
      where.wholesaler_id = filters.wholesalerId;
    }

    // Get all offers grouped by wholesaler
    const offers = await prisma.vendorOffer.findMany({
      where,
      include: {
        wholesaler: {
          select: {
            id: true,
            businessName: true,
            reliabilityScore: true,
            averageRating: true
          }
        }
      }
    });

    // Group by wholesaler and calculate statistics
    const wholesalerStats = {};
    
    offers.forEach(offer => {
      const wholesalerId = offer.wholesaler_id;
      
      if (!wholesalerStats[wholesalerId]) {
        wholesalerStats[wholesalerId] = {
          wholesaler: offer.wholesaler,
          totalOffers: 0,
          acceptedOffers: 0,
          rejectedOffers: 0,
          expiredOffers: 0,
          pendingOffers: 0,
          winRate: 0,
          totalOrderValue: 0,
          averagePriceQuote: 0,
          priceQuotes: []
        };
      }

      const stats = wholesalerStats[wholesalerId];
      stats.totalOffers++;
      stats.priceQuotes.push(Number(offer.price_quote));

      switch (offer.status) {
        case 'ACCEPTED':
          stats.acceptedOffers++;
          break;
        case 'REJECTED':
          stats.rejectedOffers++;
          break;
        case 'EXPIRED':
          stats.expiredOffers++;
          break;
        case 'PENDING':
          stats.pendingOffers++;
          break;
      }
    });

    // Calculate win rates and averages
    const result = Object.values(wholesalerStats).map(stats => {
      const winRate = stats.totalOffers > 0 
        ? (stats.acceptedOffers / stats.totalOffers) * 100 
        : 0;
      
      const avgPrice = stats.priceQuotes.length > 0
        ? stats.priceQuotes.reduce((sum, price) => sum + price, 0) / stats.priceQuotes.length
        : 0;

      return {
        wholesalerId: stats.wholesaler.id,
        businessName: stats.wholesaler.businessName,
        reliabilityScore: stats.wholesaler.reliabilityScore,
        averageRating: stats.wholesaler.averageRating,
        totalOffers: stats.totalOffers,
        acceptedOffers: stats.acceptedOffers,
        rejectedOffers: stats.rejectedOffers,
        expiredOffers: stats.expiredOffers,
        pendingOffers: stats.pendingOffers,
        winRate: Math.round(winRate * 100) / 100,
        averagePriceQuote: Math.round(avgPrice * 100) / 100,
        minPriceQuote: stats.priceQuotes.length > 0 ? Math.min(...stats.priceQuotes) : 0,
        maxPriceQuote: stats.priceQuotes.length > 0 ? Math.max(...stats.priceQuotes) : 0
      };
    });

    // Sort by win rate (descending)
    result.sort((a, b) => b.winRate - a.winRate);

    return result;
  }

  /**
   * Get comprehensive analytics dashboard data
   * @param {object} filters - Optional filters { dateRange }
   * @returns {Promise<object>} Combined analytics data
   */
  async getAnalyticsDashboard(filters = {}) {
    const [offerCounts, responseTime, winRates] = await Promise.all([
      this.getOfferCountPerOrder(filters),
      this.getAverageResponseTime(filters),
      this.getWinRatePerWholesaler(filters)
    ]);

    // Calculate summary statistics
    const totalOrders = offerCounts.length;
    const ordersWithOffers = offerCounts.filter(o => o.totalOffers > 0).length;
    const averageOffersPerOrder = totalOrders > 0
      ? offerCounts.reduce((sum, o) => sum + o.totalOffers, 0) / totalOrders
      : 0;

    return {
      summary: {
        totalOrders,
        ordersWithOffers,
        ordersWithoutOffers: totalOrders - ordersWithOffers,
        averageOffersPerOrder: Math.round(averageOffersPerOrder * 100) / 100
      },
      offerCounts: {
        total: offerCounts.length,
        orders: offerCounts.slice(0, 50) // Limit to top 50 for response
      },
      responseTime,
      winRates: {
        totalWholesalers: winRates.length,
        wholesalers: winRates.slice(0, 50) // Limit to top 50 for response
      },
      dateRange: filters.dateRange || null
    };
  }
}

module.exports = new AnalyticsService();
