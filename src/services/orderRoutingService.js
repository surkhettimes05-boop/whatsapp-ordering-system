const { PrismaClient } = require('@prisma/client');
import prisma from '../config/prismaClient.js';
const geolib = require('geolib');
const _ = require('lodash');

/**
 * Service to handle intelligent order routing to wholesalers
 */
class OrderRoutingService {
    constructor() {
        this.weights = {
            availability: 0.30,
            distance: 0.25,
            reliability: 0.20,
            pricing: 0.15,
            capacity: 0.10
        };
    }

    /**
     * Main entry point: Find the best wholesaler for a specific order request
     * @param {string} retailerId - The ID of the retailer placing the order
     * @param {Array} items - Array of { productId, quantity }
     * @param {Array} excludedWholesalerIds - Array of wholesaler IDs to ignore (for re-routing)
     * @returns {Promise<Object>} Selected wholesaler and routing details
     */
    async findBestWholesaler(retailerId, items, excludedWholesalerIds = []) {
        console.log(`🔍 Starting routing process for retailer ${retailerId}`);
        if (excludedWholesalerIds.length > 0) {
            console.log(`🚫 Excluding wholesalers: ${excludedWholesalerIds.join(', ')}`);
        }

        // 1. Fetch Retailer Location
        const retailer = await prisma.retailer.findUnique({
            where: { id: retailerId }
        });

        if (!retailer || !retailer.latitude || !retailer.longitude) {
            throw new Error('Retailer location data missing. Cannot route order.');
        }

        const retailerLocation = {
            latitude: retailer.latitude,
            longitude: retailer.longitude
        };

        // 2. Identify Products
        const productIds = items.map(item => item.productId);

        // 3. Find Candidate Wholesalers
        // Must handle at least one of the products to be considered
        // ideally should handle all, but we might need to split orders (out of scope for now, assuming single assignment)
        // We will look for wholesalers who have at least ONE of the products available
        const candidates = await this._findCandidates(productIds, excludedWholesalerIds);

        if (candidates.length === 0) {
            throw new Error('No active wholesalers found for these products.');
        }

        console.log(`📋 Found ${candidates.length} candidate wholesalers`);

        // 4. Calculate Scores for each candidate
        const scoredCandidates = await Promise.all(candidates.map(async (wholesaler) => {
            const scoreDetails = await this._calculateWholesalerScore(wholesaler, retailerLocation, items);

            // Save the detailed breakdown for debugging/logging
            return {
                wholesaler,
                ...scoreDetails
            };
        }));

        // 5. Filter out zero scores (failed critical checks like stock availability) and Sort
        const viableCandidates = scoredCandidates
            .filter(c => c.finalScore > 0)
            .sort((a, b) => b.finalScore - a.finalScore);

        if (viableCandidates.length === 0) {
            throw new Error('No viable wholesalers found after scoring (check stock/availability).');
        }

        const winner = viableCandidates[0];
        console.log(`🏆 Selected Winner: ${winner.wholesaler.businessName} (Score: ${winner.finalScore.toFixed(2)})`);

        // 6. Record the Decision (but don't create order yet - that's the controller's job)
        // We return the data needed to create the OrderRouting record
        return {
            selectedWholesaler: winner.wholesaler,
            routingScore: winner.finalScore,
            routingReason: `Best match with score ${winner.finalScore.toFixed(1)}. Dist: ${winner.breakdown.distanceValue.toFixed(1)}km, Avail: ${winner.breakdown.availabilityScore}, Price: ${winner.breakdown.pricingScore}`,
            allCandidates: viableCandidates.map(c => ({
                id: c.wholesaler.id,
                name: c.wholesaler.businessName,
                score: c.finalScore
            }))
        };
    }

    /**
     * Find active wholesalers who sell the requested products
     */
    async _findCandidates(productIds, excludedIds = []) {
        const where = {
            isActive: true,
            isVerified: true,
            products: {
                some: {
                    productId: { in: productIds },
                    isAvailable: true
                }
            }
        };

        if (excludedIds.length > 0) {
            where.id = { notIn: excludedIds };
        }

        return prisma.wholesaler.findMany({
            where,
            include: {
                products: {
                    where: {
                        productId: { in: productIds }
                    }
                }
            }
        });
    }

    /**
     * Calculate comprehensive score for a single wholesaler
     */
    async _calculateWholesalerScore(wholesaler, retailerLocation, items) {
        // A. Availability Score (30%)
        const availabilityScore = this._calculateAvailabilityScore(wholesaler, items);

        // Critical fail: If they can't fulfill the core order, score is 0
        if (availabilityScore === 0) {
            return { finalScore: 0, breakdown: { error: 'Availability 0' } };
        }

        // B. Distance Score (25%)
        // Check if within delivery radius first
        const distanceKm = this._calculateDistance(retailerLocation, wholesaler);
        if (distanceKm > wholesaler.deliveryRadius) {
            return { finalScore: 0, breakdown: { error: 'Outside delivery radius', distance: distanceKm } };
        }
        const distanceScore = this._calculateDistanceScore(distanceKm);

        // C. Reliability Score (20%)
        const reliabilityScore = wholesaler.reliabilityScore || 50;

        // D. Pricing Score (15%)
        // We need to compare against the market or just evaluate the fairness
        // For now, we calculate based on the total cart value offered by this wholesaler
        const pricingScore = await this._calculatePricingScore(wholesaler, items);

        // E. Capacity Score (10%)
        const capacityScore = this._calculateCapacityScore(wholesaler);

        // Calculate Final Weighted Score
        const finalScore = (
            (availabilityScore * this.weights.availability) +
            (distanceScore * this.weights.distance) +
            (reliabilityScore * this.weights.reliability) +
            (pricingScore * this.weights.pricing) +
            (capacityScore * this.weights.capacity)
        );

        return {
            finalScore,
            breakdown: {
                availabilityScore,
                distanceScore,
                distanceValue: distanceKm,
                reliabilityScore,
                pricingScore,
                capacityScore
            }
        };
    }

    // --- Scoring Component Methods ---

    _calculateAvailabilityScore(wholesaler, items) {
        let totalScore = 0;
        let itemsFound = 0;

        for (const item of items) {
            const whProduct = wholesaler.products.find(p => p.productId === item.productId);

            if (!whProduct || !whProduct.isAvailable) {
                // Penalty for missing items. 
                // If it's a 1-item order, this results in 0.
                // If multi-item, we average.
                continue;
            }

            itemsFound++;
            let itemScore = 0;

            // Availability = Physical Stock - Reserved Stock
            const availableStock = whProduct.stock - (whProduct.reservedStock || 0);

            if (availableStock >= item.quantity) {
                itemScore = 100;
            } else {
                // Requirement: No order should confirm without available stock.
                // If any item is unavailable, this wholesaler cannot fulfill the order.
                return 0;
            }

            totalScore += itemScore;
        }

        if (itemsFound === 0) return 0;

        // Penalize if they explicitly don't carry some items in the order
        // (itemsFound / items.length) is the fill rate
        return (totalScore / itemsFound) * (itemsFound / items.length);
    }

    _calculateDistance(retailerLoc, wholesaler) {
        // Returns distance in km
        const distMeters = geolib.getDistance(
            { latitude: retailerLoc.latitude, longitude: retailerLoc.longitude },
            { latitude: wholesaler.latitude, longitude: wholesaler.longitude }
        );
        return distMeters / 1000;
    }

    _calculateDistanceScore(distanceKm) {
        if (distanceKm < 5) return 100;
        if (distanceKm < 10) return 80;
        if (distanceKm < 20) return 60;
        if (distanceKm < 50) return 40;
        return 20; // Within radius but far
    }

    async _calculatePricingScore(wholesaler, items) {
        // 1. Calculate total cost for this wholesaler for these items
        let totalCost = 0;
        let itemsPriced = 0;

        for (const item of items) {
            const whProduct = wholesaler.products.find(p => p.productId === item.productId);
            if (whProduct) {
                totalCost += (Number(whProduct.priceOffered) * item.quantity);
                itemsPriced++;
            }
        }

        if (itemsPriced === 0) return 50; // Neutral if no pricing data found (shouldn't happen if filtered correctly)

        // 2. Get the "market average" or "best price" for these items to compare
        // Optimization: For simplicity in this iteration, we look at the 'fixedPrice' in Product table as baseline
        // Or we could query other wholesalers. Querying all is expensive.
        // Let's use the product's base `fixedPrice` as the reference "Standard Price".

        // We need to fetch the base product prices
        let standardCost = 0;
        const baseProducts = await prisma.product.findMany({
            where: { id: { in: items.map(i => i.productId) } }
        });

        for (const item of items) {
            const baseP = baseProducts.find(p => p.id === item.productId);
            if (baseP) {
                standardCost += (Number(baseP.fixedPrice) * item.quantity);
            }
        }

        if (standardCost === 0) return 50;

        // Compare: specific wholesaler price vs standard
        // If cheaper than standard -> High Score
        // If expensive -> Low Score

        const ratio = totalCost / standardCost;

        if (ratio <= 0.95) return 100; // 5% cheaper than standard
        if (ratio <= 1.0) return 90;   // At standard price
        if (ratio <= 1.05) return 70;  // 5% more expensive
        if (ratio <= 1.10) return 50;  // 10% more expensive
        if (ratio <= 1.20) return 30;  // 20% more expensive
        return 10;                     // Very expensive
    }

    _calculateCapacityScore(wholesaler) {
        if (wholesaler.capacity === 0) return 0; // Should not happen

        const usage = (wholesaler.currentOrders / wholesaler.capacity) * 100;

        if (usage >= 100) return 10; // Full
        if (usage >= 90) return 20;  // Almost full
        if (usage >= 75) return 40;
        if (usage >= 50) return 70;
        return 100; // Less than 50% utilization - Good to go
    }

    /**
     * Log the result of a routing decision
     */
    async recordRoutingDecision(orderId, retailerId, decisionData, items) {
        try {
            if (!decisionData || !decisionData.selectedWholesaler) return;

            await prisma.orderRouting.create({
                data: {
                    orderId,
                    retailerId,
                    productRequested: JSON.stringify(items),
                    candidateWholesalers: JSON.stringify(decisionData.allCandidates.map(c => c.id)),
                    selectedWholesalerId: decisionData.selectedWholesaler.id,
                    routingReason: decisionData.routingReason,
                    routingScore: decisionData.routingScore,
                    status: 'PENDING',
                    attempt: 1
                }
            });
            console.log(`📝 Routing decision recorded for Order ${orderId}`);
        } catch (error) {
            console.error('Failed to record routing decision:', error);
            // Non-blocking error
        }
    }

    /**
     * Update wholesaler reliability score based on events
     * Score logic:
     * - Accept order: +2
     * - Complete order: +5
     * - Reject order: -10
     * - Timeout (ignore): -15
     * Max: 100, Min: 0
     */
    async updateReliabilityScore(wholesalerId, event) {
        try {
            const wholesaler = await prisma.wholesaler.findUnique({
                where: { id: wholesalerId },
                select: { reliabilityScore: true }
            });

            if (!wholesaler) return;

            let change = 0;
            switch (event) {
                case 'ACCEPT': change = 2; break;
                case 'COMPLETE': change = 5; break;
                case 'REJECT': change = -10; break;
                case 'TIMEOUT': change = -15; break;
            }

            let newScore = (wholesaler.reliabilityScore || 50) + change;
            newScore = Math.max(0, Math.min(100, newScore));

            await prisma.wholesaler.update({
                where: { id: wholesalerId },
                data: { reliabilityScore: newScore }
            });

            console.log(`📈 Updated ${wholesalerId} reliability score from ${(wholesaler.reliabilityScore || 50)} to ${newScore} (Event: ${event})`);
        } catch (error) {
            console.error('Failed to update reliability score:', error);
        }
    }

    /**
     * Record a customer rating and update the wholesaler's average
     */
    async addCustomerRating(orderId, ratingValue) {
        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                select: { wholesalerId: true }
            });

            if (!order || !order.wholesalerId) return;

            // 1. Create rating record
            await prisma.wholesalerRating.create({
                data: {
                    orderId,
                    wholesalerId: order.wholesalerId,
                    rating: ratingValue,
                    comment: ''
                }
            });

            // 2. Fetch all ratings for this wholesaler to calculate new average
            const ratings = await prisma.wholesalerRating.findMany({
                where: { wholesalerId: order.wholesalerId },
                select: { rating: true }
            });

            const sum = ratings.reduce((acc, curr) => acc + curr.rating, 0);
            const average = sum / ratings.length;

            // 3. Update Wholesaler average
            await prisma.wholesaler.update({
                where: { id: order.wholesalerId },
                data: { averageRating: average }
            });

            console.log(`⭐ Wholesaler ${order.wholesalerId} new average rating: ${average.toFixed(1)}`);
        } catch (error) {
            console.error('Failed to update rating:', error);
        }
    }
}

module.exports = new OrderRoutingService();
