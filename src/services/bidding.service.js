const prisma = require('../config/database');
const { withTransaction } = require('../utils/transaction');
const { scoreAndRankOffers } = require('../utils/scoring');
const { logger } = require('../config/logger');

/**
 * High-Concurrency Vendor Bidding Service
 * 
 * Handles offer ingestion, winner selection, and auto-expiry
 * with production-grade concurrency control and audit trails
 */
class BiddingService {
    /**
     * Submit a new offer for an order (with locking to prevent late bids)
     * @param {object} params - { orderId, wholesalerId, priceQuote, deliveryEta, stockConfirmed }
     * @returns {Promise<object>} - Created VendorOffer
     */
    async submitOffer({ orderId, wholesalerId, priceQuote, deliveryEta, stockConfirmed }) {
        if (!orderId || !wholesalerId) {
            throw new Error('orderId and wholesalerId are required');
        }

        return withTransaction(async (tx) => {
            // Lock order to prevent submission after winner selected
            await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;

            // Check if order already has a winner
            const order = await tx.order.findUnique({
                where: { id: orderId },
                select: { id: true, finalWholesalerId: true, status: true, expiresAt: true }
            });

            if (!order) {
                throw new Error(`Order ${orderId} not found`);
            }

            if (order.finalWholesalerId) {
                throw new Error('Order already assigned - bidding closed');
            }

            if (order.status !== 'PENDING_BIDS') {
                throw new Error(`Order is not accepting bids (status: ${order.status})`);
            }

            // Check if bidding window expired
            if (order.expiresAt && new Date(order.expiresAt) < new Date()) {
                throw new Error('Bidding window has expired');
            }

            // Check for duplicate offer from same wholesaler
            const existingOffer = await tx.vendorOffer.findUnique({
                where: {
                    orderId_wholesalerId: {
                        orderId,
                        wholesalerId
                    }
                }
            });

            if (existingOffer) {
                throw new Error('Wholesaler has already submitted an offer for this order');
            }

            // Create offer
            const offer = await tx.vendorOffer.create({
                data: {
                    orderId,
                    wholesalerId,
                    priceQuote: Number(priceQuote || 0),
                    deliveryEta: deliveryEta || null,
                    stockConfirmed: !!stockConfirmed,
                    status: 'PENDING'
                }
            });

            // Log bid submission
            await this.logBidEvent(tx, 'BID_SUBMITTED', {
                offerId: offer.id,
                orderId,
                wholesalerId,
                priceQuote: offer.priceQuote,
                deliveryEta: offer.deliveryEta,
                stockConfirmed: offer.stockConfirmed
            });

            logger.info('Offer ingested', { offerId: offer.id, orderId, wholesalerId });
            return offer;
        }, {
            operation: 'BID_SUBMISSION',
            entityId: orderId,
            entityType: 'VendorOffer'
        });
    }

    /**
     * Select a winner for an order based on scores (atomic operation)
     * @param {string} orderId - Order ID
     * @param {object} opts - { performedBy, triggeredBy }
     * @returns {Promise<object>} - { orderId, winnerId, score, rejectedCount }
     */
    async selectWinner(orderId, opts = {}) {
        const { performedBy = 'SYSTEM', triggeredBy = 'MANUAL' } = opts;

        return withTransaction(async (tx) => {
            // STEP 1: Lock the order for update (prevents concurrent winner selection)
            await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;

            // STEP 2: Fetch order and check if already assigned
            const order = await tx.order.findUnique({
                where: { id: orderId },
                include: { retailer: true }
            });

            if (!order) {
                throw new Error(`Order ${orderId} not found`);
            }

            // Idempotency check: If already assigned, return existing winner
            if (order.finalWholesalerId) {
                const existingWinner = await tx.vendorOffer.findFirst({
                    where: { orderId, status: 'ACCEPTED' }
                });

                if (existingWinner) {
                    logger.warn('Order already assigned - returning existing winner', {
                        orderId,
                        winnerId: existingWinner.wholesalerId
                    });

                    return {
                        orderId,
                        winnerId: existingWinner.wholesalerId,
                        alreadyAssigned: true
                    };
                }

                throw new Error(`Order ${orderId} has finalWholesalerId but no ACCEPTED offer found`);
            }

            // STEP 3: Get all pending offers
            const offers = await tx.vendorOffer.findMany({
                where: { orderId, status: 'PENDING' },
                include: { wholesaler: true }
            });

            if (!offers || offers.length === 0) {
                throw new Error(`No pending offers found for order ${orderId}`);
            }

            // STEP 4: Score and rank offers
            const ranked = scoreAndRankOffers(offers);
            const winner = ranked[0];
            const losers = ranked.slice(1);

            // STEP 5: Update winner status to ACCEPTED
            await tx.vendorOffer.update({
                where: {
                    orderId_wholesalerId: {
                        orderId,
                        wholesalerId: winner.offer.wholesalerId
                    }
                },
                data: { status: 'ACCEPTED' }
            });

            // Log winner acceptance
            await this.logBidEvent(tx, 'BID_ACCEPTED', {
                offerId: winner.offer.id,
                orderId,
                wholesalerId: winner.offer.wholesalerId,
                score: winner.score,
                triggeredBy
            });

            // STEP 6: Atomically reject all losing offers
            for (const loser of losers) {
                await tx.vendorOffer.update({
                    where: {
                        orderId_wholesalerId: {
                            orderId,
                            wholesalerId: loser.offer.wholesalerId
                        }
                    },
                    data: { status: 'REJECTED' }
                });

                // Log rejection
                await this.logBidEvent(tx, 'BID_REJECTED', {
                    offerId: loser.offer.id,
                    orderId,
                    wholesalerId: loser.offer.wholesalerId,
                    score: loser.score,
                    reason: 'Lost to higher-scoring bid'
                });
            }

            // STEP 7: Assign winner to order
            await tx.order.update({
                where: { id: orderId },
                data: {
                    finalWholesalerId: winner.offer.wholesalerId,
                    wholesalerId: winner.offer.wholesalerId,
                    status: 'ASSIGNED'
                }
            });

            // STEP 8: Log the winner selection decision
            await this.logBidEvent(tx, 'WINNER_SELECTED', {
                orderId,
                winnerId: winner.offer.wholesalerId,
                winnerScore: winner.score,
                totalOffers: offers.length,
                rejectedCount: losers.length,
                performedBy,
                triggeredBy
            });

            logger.info('Bid selection committed', {
                orderId,
                winnerId: winner.offer.wholesalerId,
                score: winner.score,
                rejectedCount: losers.length
            });

            return {
                orderId,
                winnerId: winner.offer.wholesalerId,
                score: winner.score,
                rejectedCount: losers.length
            };
        }, {
            operation: 'BID_SELECTION',
            entityId: orderId,
            entityType: 'Order',
            timeout: 15000
        });
    }

    /**
     * Process expired orders and auto-select winners
     * Called by scheduled job (biddingExpiry.job.js)
     * @returns {Promise<object>} - { processed, succeeded, failed }
     */
    async processExpiredOrders() {
        const now = new Date();

        // Find orders with expired bidding windows
        const expiredOrders = await prisma.order.findMany({
            where: {
                status: 'PENDING_BIDS',
                expiresAt: { lt: now },
                finalWholesalerId: null // Not yet assigned
            },
            select: { id: true, expiresAt: true }
        });

        logger.info(`Processing ${expiredOrders.length} expired orders`);

        const results = {
            processed: expiredOrders.length,
            succeeded: 0,
            failed: 0,
            errors: []
        };

        for (const order of expiredOrders) {
            try {
                await this.selectWinner(order.id, {
                    performedBy: 'SYSTEM',
                    triggeredBy: 'AUTO_EXPIRY'
                });

                results.succeeded++;
                logger.info(`Auto-assigned winner for expired order ${order.id}`);
            } catch (error) {
                results.failed++;
                results.errors.push({
                    orderId: order.id,
                    error: error.message
                });

                logger.error(`Failed to auto-assign winner for order ${order.id}`, {
                    error: error.message
                });

                // Log failure event
                await this.logBidEvent(null, 'AUTO_EXPIRY_FAILED', {
                    orderId: order.id,
                    error: error.message,
                    expiresAt: order.expiresAt
                });
            }
        }

        return results;
    }

    /**
     * Comprehensive audit logging for bid lifecycle events
     * @param {object} tx - Prisma transaction client (or null for standalone)
     * @param {string} eventType - Event type (BID_SUBMITTED, BID_ACCEPTED, etc.)
     * @param {object} metadata - Event metadata
     */
    async logBidEvent(tx, eventType, metadata) {
        const eventDescriptions = {
            BID_SUBMITTED: 'Vendor submitted bid',
            BID_ACCEPTED: 'Bid won the auction',
            BID_REJECTED: 'Bid lost the auction',
            WINNER_SELECTED: 'Winner assigned to order',
            AUTO_EXPIRY_TRIGGERED: 'Bidding window expired - auto-selection triggered',
            AUTO_EXPIRY_FAILED: 'Auto-expiry winner selection failed',
            CONFLICT_DETECTED: 'Concurrent winner selection prevented'
        };

        const description = eventDescriptions[eventType] || eventType;

        try {
            const client = tx || prisma;

            await client.auditLog.create({
                data: {
                    entity: 'VendorOffer',
                    action: eventType,
                    description,
                    metadata: JSON.stringify({
                        ...metadata,
                        timestamp: new Date().toISOString()
                    })
                }
            });
        } catch (error) {
            // Non-blocking: Audit logging should not fail the main operation
            logger.warn('Failed to log bid event', {
                eventType,
                error: error.message
            });
        }
    }
}

module.exports = new BiddingService();
