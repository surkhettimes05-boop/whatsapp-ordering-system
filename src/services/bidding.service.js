const prisma = require('../config/database');
const { withTransaction } = require('../utils/transaction');
const { scoreOffer } = require('../utils/scoring');
const { logger } = require('../config/logger');

class BiddingService {
    /**
     * Submit a new offer for an order
     */
    async submitOffer({ orderId, wholesalerId, price_quote, delivery_eta, stock_confirmed }) {
        if (!orderId || !wholesalerId) throw new Error('orderId and wholesalerId required');

        const offer = await prisma.vendorOffer.create({
            data: {
                order_id: orderId,
                wholesaler_id: wholesalerId,
                price_quote: Number(price_quote || 0),
                delivery_eta: delivery_eta || null,
                stock_confirmed: !!stock_confirmed,
                status: 'PENDING'
            }
        });

        logger.info('Offer ingested', { offerId: offer.id, orderId, wholesalerId });
        return offer;
    }

    /**
     * Select a winner for an order based on scores
     */
    async selectWinner(orderId, opts = {}) {
        return withTransaction(async (tx) => {
            // Lock the order for update
            await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;

            const order = await tx.order.findUnique({
                where: { id: orderId },
                include: { retailer: true }
            });

            if (!order) throw new Error('Order not found');
            if (order.final_wholesaler_id) throw new Error('Order already assigned to a wholesaler');

            // Get all pending offers
            const offers = await tx.vendorOffer.findMany({
                where: { order_id: orderId, status: 'PENDING' },
                include: { wholesaler: true }
            });

            if (!offers || offers.length === 0) {
                throw new Error('No pending offers found for this order');
            }

            // Score all offers
            const scored = offers.map(offer => {
                const score = scoreOffer(offer);
                return { offer, score };
            });

            // Sort by score descending (highest first)
            scored.sort((a, b) => b.score - a.score);
            const winner = scored[0].offer;

            // Update winner status
            await tx.vendorOffer.update({
                where: {
                    order_id_wholesaler_id: {
                        order_id: orderId,
                        wholesaler_id: winner.wholesaler_id
                    }
                },
                data: { status: 'ACCEPTED' }
            });

            // Reject all other offers
            const otherOffers = scored.slice(1);
            for (const entry of otherOffers) {
                await tx.vendorOffer.update({
                    where: {
                        order_id_wholesaler_id: {
                            order_id: orderId,
                            wholesaler_id: entry.offer.wholesaler_id
                        }
                    },
                    data: { status: 'REJECTED' }
                });
            }

            // Assign winner to order
            await tx.order.update({
                where: { id: orderId },
                data: {
                    final_wholesaler_id: winner.wholesaler_id,
                    wholesalerId: winner.wholesaler_id,
                    status: 'ASSIGNED'
                }
            });

            // Log the decision
            await this.logBiddingAction(tx, orderId, 'WINNER_SELECTED', {
                winnerId: winner.wholesaler_id,
                score: scored[0].score,
                totalOffers: offers.length
            }, opts.performedBy);

            logger.info('Bid selection committed', { orderId, winner: winner.wholesaler_id });
            return { orderId, winner: winner.wholesaler_id };
        }, { operation: 'BID_SELECTION', entityId: orderId, entityType: 'Order' });
    }

    /**
     * Helper to log actions to audit log
     */
    async logBiddingAction(tx, orderId, action, metadata, adminId = 'SYSTEM') {
        try {
            // Find system admin if needed
            let targetAdminId = adminId;
            if (targetAdminId === 'SYSTEM') {
                const systemAdmin = await tx.admin.findFirst({
                    where: { email: 'system@platform.com' }
                });
                targetAdminId = systemAdmin?.id || adminId;
            }

            await tx.adminAuditLog.create({
                data: {
                    adminId: targetAdminId,
                    action: `BIDDING_${action}`,
                    targetId: orderId,
                    reason: `Action: ${action}`,
                    metadata: JSON.stringify(metadata)
                }
            });
        } catch (e) {
            console.warn('Failed to log bidding action:', e.message);
        }
    }
}

module.exports = new BiddingService();
