/**
 * Bidding Controller
 * 
 * HTTP endpoints for competitive bidding system
 */

const biddingService = require('../services/bidding.service');
const scoringService = require('../services/scoring.service');
const prisma = require('../config/database');

class BiddingController {
    /**
     * Broadcast order to wholesalers
     * POST /api/v1/bidding/broadcast/:orderId
     */
    async broadcastOrder(req, res) {
        try {
            const { orderId } = req.params;
            const { wholesalerIds, radius } = req.body;

            const result = await biddingService.broadcastOrder(orderId, {
                wholesalerIds,
                radius: radius || 50
            });

            res.json({
                success: true,
                message: 'Order broadcasted successfully',
                data: result
            });
        } catch (error) {
            console.error('Error broadcasting order:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Ingest vendor offer (bid)
     * POST /api/v1/bidding/offers
     */
    async ingestOffer(req, res) {
        try {
            const { orderId, wholesalerId, priceQuote, deliveryEta, stockConfirmed } = req.body;

            if (!orderId || !wholesalerId || !priceQuote || !deliveryEta) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: orderId, wholesalerId, priceQuote, deliveryEta'
                });
            }

            const result = await biddingService.ingestOffer(orderId, wholesalerId, {
                priceQuote,
                deliveryEta,
                stockConfirmed: stockConfirmed || false
            });

            res.json({
                success: true,
                message: result.isUpdate ? 'Offer updated successfully' : 'Offer submitted successfully',
                data: {
                    offer: result.offer,
                    score: result.score
                }
            });
        } catch (error) {
            console.error('Error ingesting offer:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get all offers for an order with scores
     * GET /api/v1/bidding/offers/:orderId
     */
    async getOrderOffers(req, res) {
        try {
            const { orderId } = req.params;

            const offers = await prisma.vendorOffer.findMany({
                where: { orderId },
                include: {
                    wholesaler: {
                        select: {
                            id: true,
                            businessName: true,
                            reliabilityScore: true,
                            totalOrders: true,
                            completedOrders: true,
                            averageRating: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            // Score all offers
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                select: { id: true, totalAmount: true }
            });

            const scoredOffers = await Promise.all(
                offers.map(async (offer) => {
                    const score = await scoringService.scoreOffer(offer, order);
                    return {
                        ...offer,
                        score
                    };
                })
            );

            // Sort by score (highest first)
            scoredOffers.sort((a, b) => b.score.totalScore - a.score.totalScore);

            res.json({
                success: true,
                data: {
                    orderId,
                    totalOffers: scoredOffers.length,
                    offers: scoredOffers
                }
            });
        } catch (error) {
            console.error('Error getting order offers:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Manually trigger auto-selection (admin only)
     * POST /api/v1/bidding/auto-select/:orderId
     */
    async triggerAutoSelect(req, res) {
        try {
            const { orderId } = req.params;

            const result = await biddingService.autoSelectWinner(orderId);

            res.json({
                success: result.success,
                message: result.success ? 'Winner selected successfully' : result.reason,
                data: result
            });
        } catch (error) {
            console.error('Error triggering auto-selection:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new BiddingController();
