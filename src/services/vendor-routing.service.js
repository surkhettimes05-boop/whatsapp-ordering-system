const { PrismaClient } = require('@prisma/client');
const { logger } = require('../infrastructure/logger');
const { MetricsCollector } = require('../monitoring/metrics');

class VendorRoutingService {
  constructor() {
    this.prisma = new PrismaClient();
    this.metrics = new MetricsCollector();
    
    // Scoring weights (configurable via environment)
    this.scoringWeights = {
      price: parseFloat(process.env.ROUTING_WEIGHT_PRICE) || 0.3,
      delivery: parseFloat(process.env.ROUTING_WEIGHT_DELIVERY) || 0.25,
      reliability: parseFloat(process.env.ROUTING_WEIGHT_RELIABILITY) || 0.25,
      credit: parseFloat(process.env.ROUTING_WEIGHT_CREDIT) || 0.2
    };
    
    // Routing configuration
    this.config = {
      maxVendorsToConsider: parseInt(process.env.ROUTING_MAX_VENDORS) || 10,
      fallbackVendorCount: parseInt(process.env.ROUTING_FALLBACK_COUNT) || 3,
      bidTimeoutMinutes: parseInt(process.env.ROUTING_BID_TIMEOUT) || 30,
      autoAcceptThreshold: parseFloat(process.env.ROUTING_AUTO_ACCEPT_THRESHOLD) || 85
    };
  }

  /**
   * Main routing function - finds best vendors for an order
   */
  async routeOrder(orderId, orderData) {
    const startTime = Date.now();
    
    try {
      logger.info('Starting order routing', {
        action: 'routing_started',
        orderId,
        orderValue: orderData.totalAmount,
        itemCount: orderData.items?.length
      });

      // 1. Find eligible vendors
      const eligibleVendors = await this.findEligibleVendors(orderData);
      
      if (eligibleVendors.length === 0) {
        throw new Error('No eligible vendors found for order');
      }

      // 2. Score vendors
      const scoredVendors = await this.scoreVendors(eligibleVendors, orderData);
      
      // 3. Apply overrides
      const finalVendors = await this.applyOverrides(scoredVendors, orderData);
      
      // 4. Select primary and fallback vendors
      const routingResult = this.selectVendors(finalVendors);
      
      // 5. Log routing decision
      await this.logRoutingDecision(orderId, {
        totalVendors: eligibleVendors.length,
        eligibleVendors: eligibleVendors.length,
        scoringWeights: this.scoringWeights,
        vendorScores: finalVendors.map(v => ({
          vendorId: v.id,
          score: v.routingScore,
          rank: v.routingRank
        })),
        selectedVendorId: routingResult.primary?.id,
        fallbackVendors: routingResult.fallbacks.map(v => v.id),
        processingTimeMs: Date.now() - startTime
      });

      logger.info('Order routing completed', {
        action: 'routing_completed',
        orderId,
        primaryVendor: routingResult.primary?.id,
        fallbackCount: routingResult.fallbacks.length,
        processingTime: Date.now() - startTime
      });

      return routingResult;

    } catch (error) {
      logger.error('Order routing failed', {
        action: 'routing_failed',
        orderId,
        error: error.message,
        processingTime: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Find vendors eligible for the order
   */
  async findEligibleVendors(orderData) {
    const { deliveryAddress, items, totalAmount, requiresCredit } = orderData;
    
    // Build vendor query with filters
    const vendorQuery = {
      where: {
        isActive: true,
        isVerified: true,
        // Credit filter
        ...(requiresCredit && {
          acceptsCredit: true,
          creditLimit: { gte: totalAmount }
        }),
        // Product availability filter
        products: {
          some: {
            productId: { in: items.map(item => item.productId) },
            isAvailable: true,
            stockQuantity: { gte: items.find(item => item.productId)?.quantity || 1 }
          }
        },
        // Delivery zone filter
        deliveryZones: {
          some: {
            isActive: true,
            // Add geographic filtering logic here
          }
        }
      },
      include: {
        products: {
          where: {
            productId: { in: items.map(item => item.productId) },
            isAvailable: true
          }
        },
        performanceScore: true,
        deliveryZones: {
          where: { isActive: true }
        }
      }
    };

    const vendors = await this.prisma.vendor.findMany(vendorQuery);
    
    // Additional filtering logic
    const eligibleVendors = vendors.filter(vendor => {
      // Check if vendor can fulfill all items
      const vendorProductIds = vendor.products.map(p => p.productId);
      const canFulfillAll = items.every(item => 
        vendorProductIds.includes(item.productId)
      );
      
      if (!canFulfillAll) return false;
      
      // Check delivery zone coverage
      const canDeliver = this.checkDeliveryZone(vendor.deliveryZones, deliveryAddress);
      if (!canDeliver) return false;
      
      // Check minimum order requirements
      const meetsMinimum = vendor.deliveryZones.some(zone => 
        zone.minimumOrder <= totalAmount
      );
      
      return meetsMinimum;
    });

    logger.info('Eligible vendors found', {
      action: 'eligible_vendors_found',
      totalVendors: vendors.length,
      eligibleVendors: eligibleVendors.length,
      filters: {
        requiresCredit,
        itemCount: items.length,
        totalAmount
      }
    });

    return eligibleVendors;
  }

  /**
   * Score vendors based on multiple criteria
   */
  async scoreVendors(vendors, orderData) {
    const scoredVendors = [];
    
    for (const vendor of vendors) {
      const scores = await this.calculateVendorScores(vendor, orderData);
      const overallScore = this.calculateOverallScore(scores);
      
      scoredVendors.push({
        ...vendor,
        routingScore: overallScore,
        scoreBreakdown: scores
      });
    }
    
    // Sort by score (highest first)
    scoredVendors.sort((a, b) => b.routingScore - a.routingScore);
    
    // Add ranking
    scoredVendors.forEach((vendor, index) => {
      vendor.routingRank = index + 1;
    });
    
    return scoredVendors;
  }

  /**
   * Calculate individual scores for a vendor
   */
  async calculateVendorScores(vendor, orderData) {
    const scores = {
      price: await this.calculatePriceScore(vendor, orderData),
      delivery: await this.calculateDeliveryScore(vendor, orderData),
      reliability: await this.calculateReliabilityScore(vendor),
      credit: await this.calculateCreditScore(vendor, orderData)
    };
    
    return scores;
  }

  /**
   * Calculate price competitiveness score (0-100)
   */
  async calculatePriceScore(vendor, orderData) {
    try {
      let totalVendorPrice = 0;
      
      for (const item of orderData.items) {
        const vendorProduct = vendor.products.find(p => p.productId === item.productId);
        if (!vendorProduct) return 0;
        
        const price = vendorProduct.discountPrice || vendorProduct.basePrice;
        totalVendorPrice += price * item.quantity;
      }
      
      // Add delivery fee
      const deliveryZone = vendor.deliveryZones[0]; // Use first applicable zone
      totalVendorPrice += deliveryZone?.deliveryFee || 0;
      
      // Get market average price for comparison
      const marketAverage = await this.getMarketAveragePrice(orderData.items);
      
      if (marketAverage === 0) return 50; // Neutral score if no market data
      
      // Score: lower price = higher score
      const priceRatio = totalVendorPrice / marketAverage;
      let score = Math.max(0, Math.min(100, 100 - (priceRatio - 1) * 100));
      
      return Math.round(score);
      
    } catch (error) {
      logger.error('Price score calculation failed', {
        action: 'price_score_failed',
        vendorId: vendor.id,
        error: error.message
      });
      return 50; // Default neutral score
    }
  }

  /**
   * Calculate delivery time score (0-100)
   */
  async calculateDeliveryScore(vendor, orderData) {
    try {
      // Get estimated delivery time
      const deliveryZone = vendor.deliveryZones[0];
      const estimatedHours = deliveryZone?.maxDeliveryTime || 24;
      
      // Score based on delivery speed (faster = higher score)
      // 2 hours = 100, 24 hours = 50, 48+ hours = 0
      let score = Math.max(0, Math.min(100, 100 - (estimatedHours - 2) * 2));
      
      // Adjust based on historical performance
      if (vendor.performanceScore?.avgDeliveryTime) {
        const actualAvg = vendor.performanceScore.avgDeliveryTime;
        const performanceRatio = actualAvg / estimatedHours;
        
        if (performanceRatio > 1.2) {
          score *= 0.8; // Penalty for consistently late deliveries
        } else if (performanceRatio < 0.8) {
          score *= 1.1; // Bonus for consistently early deliveries
        }
      }
      
      return Math.round(Math.min(100, score));
      
    } catch (error) {
      logger.error('Delivery score calculation failed', {
        action: 'delivery_score_failed',
        vendorId: vendor.id,
        error: error.message
      });
      return 50;
    }
  }

  /**
   * Calculate reliability score (0-100)
   */
  async calculateReliabilityScore(vendor) {
    try {
      const performance = vendor.performanceScore;
      
      if (!performance || performance.totalOrders < 5) {
        return 50; // Neutral score for new vendors
      }
      
      // Base reliability metrics
      const completionRate = (performance.completedOrders / performance.totalOrders) * 100;
      const onTimeRate = performance.onTimeDeliveryRate || 0;
      const qualityScore = (performance.avgRating || 3) * 20; // Convert 1-5 to 0-100
      
      // Penalty factors
      const cancellationPenalty = (performance.cancelledOrders / performance.totalOrders) * 50;
      const complaintPenalty = performance.complaintRate || 0;
      
      // Calculate composite score
      let score = (completionRate * 0.4) + (onTimeRate * 0.3) + (qualityScore * 0.3);
      score -= cancellationPenalty + complaintPenalty;
      
      return Math.round(Math.max(0, Math.min(100, score)));
      
    } catch (error) {
      logger.error('Reliability score calculation failed', {
        action: 'reliability_score_failed',
        vendorId: vendor.id,
        error: error.message
      });
      return 50;
    }
  }

  /**
   * Calculate credit acceptance score (0-100)
   */
  async calculateCreditScore(vendor, orderData) {
    try {
      if (!orderData.requiresCredit) {
        return 100; // Full score if credit not needed
      }
      
      if (!vendor.acceptsCredit) {
        return 0; // No score if vendor doesn't accept credit
      }
      
      const availableCredit = vendor.creditLimit - vendor.currentCredit;
      const requiredCredit = orderData.totalAmount;
      
      if (availableCredit < requiredCredit) {
        return 0; // No score if insufficient credit
      }
      
      // Score based on credit utilization
      const utilizationRatio = requiredCredit / vendor.creditLimit;
      
      // Lower utilization = higher score
      let score = Math.max(0, Math.min(100, 100 - (utilizationRatio * 50)));
      
      // Bonus for excellent credit rating
      switch (vendor.creditRating) {
        case 'EXCELLENT':
          score *= 1.2;
          break;
        case 'GOOD':
          score *= 1.1;
          break;
        case 'FAIR':
          score *= 1.0;
          break;
        case 'POOR':
          score *= 0.8;
          break;
        default:
          score *= 0.9;
      }
      
      return Math.round(Math.min(100, score));
      
    } catch (error) {
      logger.error('Credit score calculation failed', {
        action: 'credit_score_failed',
        vendorId: vendor.id,
        error: error.message
      });
      return 50;
    }
  }

  /**
   * Calculate overall weighted score
   */
  calculateOverallScore(scores) {
    const weightedScore = 
      (scores.price * this.scoringWeights.price) +
      (scores.delivery * this.scoringWeights.delivery) +
      (scores.reliability * this.scoringWeights.reliability) +
      (scores.credit * this.scoringWeights.credit);
    
    return Math.round(weightedScore);
  }

  /**
   * Apply admin overrides to vendor scores
   */
  async applyOverrides(vendors, orderData) {
    try {
      // Get active overrides
      const overrides = await this.prisma.vendorOverride.findMany({
        where: {
          isActive: true,
          validFrom: { lte: new Date() },
          OR: [
            { validUntil: null },
            { validUntil: { gte: new Date() } }
          ]
        }
      });
      
      const modifiedVendors = [...vendors];
      
      for (const override of overrides) {
        await this.applyOverride(modifiedVendors, override, orderData);
      }
      
      // Re-sort after overrides
      modifiedVendors.sort((a, b) => b.routingScore - a.routingScore);
      
      // Update rankings
      modifiedVendors.forEach((vendor, index) => {
        vendor.routingRank = index + 1;
      });
      
      return modifiedVendors;
      
    } catch (error) {
      logger.error('Override application failed', {
        action: 'override_failed',
        error: error.message
      });
      return vendors; // Return original vendors if override fails
    }
  }

  /**
   * Apply a single override
   */
  async applyOverride(vendors, override, orderData) {
    const { overrideType, vendorId, overrideValue, conditions } = override;
    
    // Check conditions if specified
    if (conditions && !this.evaluateConditions(conditions, orderData)) {
      return;
    }
    
    // Find target vendors
    const targetVendors = vendorId 
      ? vendors.filter(v => v.id === vendorId)
      : vendors; // Global override
    
    for (const vendor of targetVendors) {
      switch (overrideType) {
        case 'VENDOR_PRIORITY':
          vendor.routingScore = Math.min(100, vendor.routingScore + overrideValue.boost);
          break;
          
        case 'PRICE_ADJUSTMENT':
          if (vendor.scoreBreakdown) {
            vendor.scoreBreakdown.price += overrideValue.adjustment;
            vendor.routingScore = this.calculateOverallScore(vendor.scoreBreakdown);
          }
          break;
          
        case 'ROUTING_EXCLUSION':
          vendor.routingScore = 0; // Exclude from routing
          break;
          
        default:
          logger.warn('Unknown override type', {
            action: 'unknown_override',
            overrideType,
            overrideId: override.id
          });
      }
    }
    
    // Update usage tracking
    await this.prisma.vendorOverride.update({
      where: { id: override.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date()
      }
    });
  }

  /**
   * Select primary and fallback vendors
   */
  selectVendors(scoredVendors) {
    const eligibleVendors = scoredVendors.filter(v => v.routingScore > 0);
    
    if (eligibleVendors.length === 0) {
      throw new Error('No vendors available after scoring and overrides');
    }
    
    const primary = eligibleVendors[0];
    const fallbacks = eligibleVendors
      .slice(1, this.config.fallbackVendorCount + 1);
    
    return {
      primary,
      fallbacks,
      allEligible: eligibleVendors
    };
  }

  /**
   * Helper methods
   */
  checkDeliveryZone(deliveryZones, address) {
    // Simplified delivery zone check
    // In production, this would use proper geographic calculations
    return deliveryZones.length > 0;
  }

  async getMarketAveragePrice(items) {
    try {
      // Calculate market average price across all vendors
      const productIds = items.map(item => item.productId);
      
      const avgPrices = await this.prisma.vendorProduct.groupBy({
        by: ['productId'],
        where: {
          productId: { in: productIds },
          isAvailable: true
        },
        _avg: {
          basePrice: true
        }
      });
      
      let totalMarketPrice = 0;
      for (const item of items) {
        const avgPrice = avgPrices.find(p => p.productId === item.productId)?._avg.basePrice || 0;
        totalMarketPrice += avgPrice * item.quantity;
      }
      
      return totalMarketPrice;
      
    } catch (error) {
      logger.error('Market price calculation failed', {
        action: 'market_price_failed',
        error: error.message
      });
      return 0;
    }
  }

  evaluateConditions(conditions, orderData) {
    // Simplified condition evaluation
    // In production, this would be a more sophisticated rule engine
    try {
      if (conditions.minOrderValue && orderData.totalAmount < conditions.minOrderValue) {
        return false;
      }
      
      if (conditions.maxOrderValue && orderData.totalAmount > conditions.maxOrderValue) {
        return false;
      }
      
      if (conditions.requiredRegion && orderData.region !== conditions.requiredRegion) {
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('Condition evaluation failed', {
        action: 'condition_eval_failed',
        error: error.message
      });
      return false;
    }
  }

  async logRoutingDecision(orderId, routingData) {
    try {
      await this.prisma.routingLog.create({
        data: {
          orderId,
          routingStrategy: 'weighted_scoring_v1',
          totalVendors: routingData.totalVendors,
          eligibleVendors: routingData.eligibleVendors,
          scoringWeights: routingData.scoringWeights,
          vendorScores: routingData.vendorScores,
          selectedVendorId: routingData.selectedVendorId,
          fallbackVendors: routingData.fallbackVendors,
          processingTimeMs: routingData.processingTimeMs,
          routingVersion: '1.0'
        }
      });
    } catch (error) {
      logger.error('Routing log creation failed', {
        action: 'routing_log_failed',
        orderId,
        error: error.message
      });
    }
  }
}

module.exports = VendorRoutingService;