/**
 * Scoring Service
 * 
 * Competitive bidding scoring algorithm
 * Scores vendor offers based on multiple criteria
 */

const prisma = require('../config/database');

class ScoringService {
    /**
     * Score weights configuration
     */
    WEIGHTS = {
        PRICE: 0.35,           // 35% - Lower price is better
        DELIVERY_TIME: 0.25,    // 25% - Faster delivery is better
        RELIABILITY: 0.20,      // 20% - Higher reliability is better
        RATING: 0.10,           // 10% - Higher rating is better
        STOCK_CONFIRMED: 0.10   // 10% - Stock confirmation bonus
    };

    /**
     * Score an offer based on multiple criteria
     * @param {object} offer - VendorOffer with wholesaler data
     * @param {object} order - Order data (optional, for context)
     * @returns {Promise<object>} - Score breakdown and total score
     */
    async scoreOffer(offer, order = null) {
        const wholesaler = offer.wholesaler || await this.getWholesaler(offer.wholesalerId);
        
        // Calculate individual component scores
        const priceScore = this.scorePrice(offer.priceQuote, order?.totalAmount);
        const deliveryScore = this.scoreDeliveryTime(offer.deliveryEta);
        const reliabilityScore = this.scoreReliability(wholesaler);
        const ratingScore = this.scoreRating(wholesaler);
        const stockScore = this.scoreStockConfirmation(offer.stockConfirmed);

        // Weighted composite score
        const totalScore = (
            priceScore * this.WEIGHTS.PRICE +
            deliveryScore * this.WEIGHTS.DELIVERY_TIME +
            reliabilityScore * this.WEIGHTS.RELIABILITY +
            ratingScore * this.WEIGHTS.RATING +
            stockScore * this.WEIGHTS.STOCK_CONFIRMED
        );

        return {
            totalScore: Math.round(totalScore * 100) / 100, // Round to 2 decimal places
            breakdown: {
                price: {
                    score: priceScore,
                    weight: this.WEIGHTS.PRICE,
                    weightedScore: priceScore * this.WEIGHTS.PRICE
                },
                deliveryTime: {
                    score: deliveryScore,
                    weight: this.WEIGHTS.DELIVERY_TIME,
                    weightedScore: deliveryScore * this.WEIGHTS.DELIVERY_TIME
                },
                reliability: {
                    score: reliabilityScore,
                    weight: this.WEIGHTS.RELIABILITY,
                    weightedScore: reliabilityScore * this.WEIGHTS.RELIABILITY
                },
                rating: {
                    score: ratingScore,
                    weight: this.WEIGHTS.RATING,
                    weightedScore: ratingScore * this.WEIGHTS.RATING
                },
                stockConfirmed: {
                    score: stockScore,
                    weight: this.WEIGHTS.STOCK_CONFIRMED,
                    weightedScore: stockScore * this.WEIGHTS.STOCK_CONFIRMED
                }
            },
            metadata: {
                priceQuote: Number(offer.priceQuote),
                deliveryEta: offer.deliveryEta,
                stockConfirmed: offer.stockConfirmed,
                wholesalerId: offer.wholesalerId,
                wholesalerName: wholesaler?.businessName || 'Unknown'
            }
        };
    }

    /**
     * Score price component (0-100, higher is better)
     * Lower price = higher score
     * @param {number|string} priceQuote - Quoted price
     * @param {number|string} orderAmount - Order total amount (for comparison)
     * @returns {number} - Score 0-100
     */
    scorePrice(priceQuote, orderAmount = null) {
        const price = Number(priceQuote);
        const orderTotal = orderAmount ? Number(orderAmount) : price * 1.2; // Default 20% markup assumption

        // Normalize: Lower price relative to order total = higher score
        // If price is 10% below order total, score is 100
        // If price equals order total, score is 50
        // If price is 20% above order total, score is 0
        const priceRatio = price / orderTotal;
        
        if (priceRatio <= 0.9) {
            return 100; // Excellent price (10%+ discount)
        } else if (priceRatio <= 1.0) {
            return 75 + (0.9 - priceRatio) * 250; // 75-100 for 0.9-1.0 ratio
        } else if (priceRatio <= 1.1) {
            return 50 + (1.0 - priceRatio) * 250; // 50-75 for 1.0-1.1 ratio
        } else if (priceRatio <= 1.2) {
            return 25 + (1.1 - priceRatio) * 250; // 25-50 for 1.1-1.2 ratio
        } else {
            return Math.max(0, 25 - (priceRatio - 1.2) * 125); // 0-25 for >1.2 ratio
        }
    }

    /**
     * Score delivery time component (0-100, higher is better)
     * Faster delivery = higher score
     * @param {string} deliveryEta - ETA string (e.g., "2H", "3 hours", "1D")
     * @returns {number} - Score 0-100
     */
    scoreDeliveryTime(deliveryEta) {
        if (!deliveryEta) return 0;

        const hours = this.parseETA(deliveryEta);
        
        // Score based on delivery time
        // 0-2 hours: 100 points
        // 2-6 hours: 90-100 points
        // 6-12 hours: 70-90 points
        // 12-24 hours: 50-70 points
        // 24-48 hours: 30-50 points
        // 48+ hours: 0-30 points
        
        if (hours <= 2) {
            return 100;
        } else if (hours <= 6) {
            return 100 - (hours - 2) * 2.5; // 100 to 90
        } else if (hours <= 12) {
            return 90 - (hours - 6) * 3.33; // 90 to 70
        } else if (hours <= 24) {
            return 70 - (hours - 12) * 1.67; // 70 to 50
        } else if (hours <= 48) {
            return 50 - (hours - 24) * 0.83; // 50 to 30
        } else {
            return Math.max(0, 30 - (hours - 48) * 0.5); // 30 to 0
        }
    }

    /**
     * Score reliability component (0-100, higher is better)
     * Based on reliability score and order completion rate
     * @param {object} wholesaler - Wholesaler object
     * @returns {number} - Score 0-100
     */
    scoreReliability(wholesaler) {
        if (!wholesaler) return 50; // Default neutral score

        const reliabilityScore = wholesaler.reliabilityScore || 50;
        const totalOrders = wholesaler.totalOrders || 0;
        const completedOrders = wholesaler.completedOrders || 0;
        
        // Completion rate (0-1)
        const completionRate = totalOrders > 0 ? completedOrders / totalOrders : 0.5;
        
        // Combine reliability score (0-100) with completion rate
        // 70% weight on reliability score, 30% on completion rate
        const score = (reliabilityScore * 0.7) + (completionRate * 100 * 0.3);
        
        return Math.min(100, Math.max(0, score));
    }

    /**
     * Score rating component (0-100, higher is better)
     * Based on average rating (0-5 scale)
     * @param {object} wholesaler - Wholesaler object
     * @returns {number} - Score 0-100
     */
    scoreRating(wholesaler) {
        if (!wholesaler) return 50; // Default neutral score

        const averageRating = wholesaler.averageRating || 0;
        
        // Convert 0-5 rating to 0-100 score
        return (averageRating / 5) * 100;
    }

    /**
     * Score stock confirmation component (0-100, higher is better)
     * Bonus for confirmed stock availability
     * @param {boolean} stockConfirmed - Whether stock is confirmed
     * @returns {number} - Score 0 or 100
     */
    scoreStockConfirmation(stockConfirmed) {
        return stockConfirmed ? 100 : 0;
    }

    /**
     * Parse ETA string to hours
     * @param {string} eta - ETA string (e.g., "2H", "3 hours", "1D")
     * @returns {number} - Hours
     */
    parseETA(eta) {
        if (!eta) return 24; // Default 24 hours

        const etaLower = eta.toLowerCase().trim();
        let hours = 24; // Default

        // Parse common formats
        if (etaLower.includes('h') && !etaLower.includes('hour')) {
            // Format: "2H", "3h"
            const match = etaLower.match(/(\d+)\s*h/);
            hours = match ? parseInt(match[1]) : 24;
        } else if (etaLower.includes('hour')) {
            // Format: "3 hours", "1 hour"
            const match = etaLower.match(/(\d+)\s*hour/);
            hours = match ? parseInt(match[1]) : 24;
        } else if (etaLower.includes('day') || (etaLower.includes('d') && !etaLower.includes('hour'))) {
            // Format: "1 day", "2D"
            const match = etaLower.match(/(\d+)\s*(day|d)/);
            hours = match ? parseInt(match[1]) * 24 : 24;
        } else if (etaLower.includes('min')) {
            // Format: "30 min", "45 minutes"
            const match = etaLower.match(/(\d+)\s*min/);
            hours = match ? parseInt(match[1]) / 60 : 1;
        } else {
            // Try to extract any number (assume hours)
            const match = etaLower.match(/(\d+)/);
            hours = match ? parseInt(match[1]) : 24;
        }

        return Math.max(0, hours);
    }

    /**
     * Get wholesaler data
     * @param {string} wholesalerId - Wholesaler ID
     * @returns {Promise<object>} - Wholesaler data
     */
    async getWholesaler(wholesalerId) {
        return await prisma.wholesaler.findUnique({
            where: { id: wholesalerId },
            select: {
                id: true,
                businessName: true,
                reliabilityScore: true,
                totalOrders: true,
                completedOrders: true,
                averageRating: true
            }
        });
    }

    /**
     * Compare two offers
     * @param {object} offer1 - First offer with score
     * @param {object} offer2 - Second offer with score
     * @returns {number} - Negative if offer1 < offer2, positive if offer1 > offer2, 0 if equal
     */
    compareOffers(offer1, offer2) {
        const score1 = offer1.score?.totalScore || 0;
        const score2 = offer2.score?.totalScore || 0;
        return score2 - score1; // Higher score is better
    }
}

module.exports = new ScoringService();
