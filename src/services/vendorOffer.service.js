const prisma = require('../config/database');
const messageParser = require('./messageParser.service');
const whatsappService = require('./whatsapp.service');

/**
 * Vendor Offer Service
 * Handles creation and validation of vendor offers (bids) on orders
 */
class VendorOfferService {
    /**
     * Process an incoming vendor bid from WhatsApp
     * @param {string} wholesalerId - ID of the wholesaler submitting the bid
     * @param {string} messageText - Raw message text from WhatsApp
     * @returns {Promise<object>} - Result with success status and message
     */
    async processIncomingBid(wholesalerId, messageText) {
        try {
            // STEP 1: Validate sender is a wholesaler
            const wholesaler = await this.validateWholesaler(wholesalerId);
            if (!wholesaler.valid) {
                return {
                    success: false,
                    message: wholesaler.message
                };
            }

            // STEP 2: Parse the message
            const parsedBid = messageParser.parseVendorBid(messageText);
            if (!parsedBid) {
                return {
                    success: false,
                    message: '❌ Invalid bid format. Please use:\nPRICE <amount> ETA <time>\nExample: PRICE 2450 ETA 2H'
                };
            }

            // STEP 3: Find eligible order for this wholesaler
            const orderValidation = await this.findEligibleOrder(wholesalerId);
            if (!orderValidation.valid) {
                return {
                    success: false,
                    message: orderValidation.message
                };
            }

            const order = orderValidation.order;

            // STEP 4: Create or update the vendor offer
            const offerResult = await this.createOrUpdateOffer(
                order.id,
                wholesalerId,
                parsedBid.price,
                parsedBid.eta
            );

            if (!offerResult.success) {
                return {
                    success: false,
                    message: offerResult.message
                };
            }

            // STEP 5: Send confirmation to vendor
            const confirmationMessage = this.buildConfirmationMessage(
                order,
                parsedBid.price,
                parsedBid.eta
            );

            console.log(`✅ Bid recorded from ${wholesaler.data.businessName} for Order #${order.id.slice(-4)}: Rs. ${parsedBid.price}, ETA: ${parsedBid.eta}`);

            return {
                success: true,
                message: confirmationMessage,
                orderId: order.id,
                offerId: offerResult.offerId
            };

        } catch (error) {
            console.error('Error processing vendor bid:', error);
            return {
                success: false,
                message: '⚠️ System error processing your bid. Please try again or contact support.'
            };
        }
    }

    /**
     * Validate that the sender is a registered wholesaler
     * @param {string} wholesalerId
     * @returns {Promise<object>}
     */
    async validateWholesaler(wholesalerId) {
        const wholesaler = await prisma.wholesaler.findUnique({
            where: { id: wholesalerId },
            select: {
                id: true,
                businessName: true,
                isActive: true
            }
        });

        if (!wholesaler) {
            return {
                valid: false,
                message: '❌ Wholesaler account not found.'
            };
        }

        if (!wholesaler.isActive) {
            return {
                valid: false,
                message: '❌ Your wholesaler account is currently inactive. Please contact support.'
            };
        }

        return {
            valid: true,
            data: wholesaler
        };
    }

    /**
     * Find an active, non-expired order that this wholesaler can bid on
     * @param {string} wholesalerId
     * @returns {Promise<object>}
     */
    async findEligibleOrder(wholesalerId) {
        const now = new Date();

        // Find all active orders that haven't expired
        const activeOrders = await prisma.order.findMany({
            where: {
                expires_at: { gt: now },
                status: 'PENDING_BIDS'
            },
            include: {
                routing: {
                    orderBy: { timestamp: 'desc' },
                    take: 1
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (activeOrders.length === 0) {
            return {
                valid: false,
                message: '❌ No active orders available for bidding at this time.'
            };
        }

        // Find the order where this wholesaler was invited to bid
        for (const order of activeOrders) {
            if (order.routing && order.routing.length > 0) {
                const routing = order.routing[0];

                if (routing.candidateWholesalers) {
                    try {
                        const candidates = JSON.parse(routing.candidateWholesalers);
                        if (Array.isArray(candidates) && candidates.includes(wholesalerId)) {
                            return {
                                valid: true,
                                order: order
                            };
                        }
                    } catch (parseError) {
                        console.error('Error parsing candidateWholesalers:', parseError);
                    }
                }
            }
        }

        return {
            valid: false,
            message: '❌ No active order found for your bid. The order may have expired or you were not selected as a candidate.'
        };
    }

    /**
     * Create or update a vendor offer (prevents duplicates)
     * @param {string} orderId
     * @param {string} wholesalerId
     * @param {number} price
     * @param {string} eta
     * @returns {Promise<object>}
     */
    async createOrUpdateOffer(orderId, wholesalerId, price, eta) {
        try {
            const offer = await prisma.vendorOffer.upsert({
                where: {
                    order_id_wholesaler_id: {
                        order_id: orderId,
                        wholesaler_id: wholesalerId
                    }
                },
                update: {
                    price_quote: price,
                    delivery_eta: eta
                },
                create: {
                    order_id: orderId,
                    wholesaler_id: wholesalerId,
                    price_quote: price,
                    delivery_eta: eta
                }
            });

            return {
                success: true,
                offerId: offer.id
            };

        } catch (error) {
            console.error('Database error creating/updating offer:', error);
            return {
                success: false,
                message: '⚠️ Failed to save your bid. Please try again.'
            };
        }
    }

    /**
     * Build confirmation message for the vendor
     * @param {object} order
     * @param {number} price
     * @param {string} eta
     * @returns {string}
     */
    buildConfirmationMessage(order, price, eta) {
        const orderShortId = order.id.slice(-4);

        return `✅ *Bid Recorded Successfully*

Order: #${orderShortId}
Your Price: Rs. ${price}
Your ETA: ${eta}

Your bid has been submitted. The customer will be notified of all offers when the bidding period closes.

You can update your bid by sending another message with the same format.`;
    }

    /**
     * Get all offers for a specific order
     * @param {string} orderId
     * @returns {Promise<Array>}
     */
    async getOffersForOrder(orderId) {
        return await prisma.vendorOffer.findMany({
            where: { order_id: orderId },
            include: {
                wholesaler: {
                    select: {
                        id: true,
                        businessName: true,
                        reliabilityScore: true,
                        averageRating: true
                    }
                }
            },
            orderBy: { price_quote: 'asc' } // Lowest price first
        });
    }

    /**
     * Get the best (lowest price) offer for an order
     * @param {string} orderId
     * @returns {Promise<object|null>}
     */
    async getBestOffer(orderId) {
        const offers = await this.getOffersForOrder(orderId);
        return offers.length > 0 ? offers[0] : null;
    }

    /**
     * Check if a wholesaler has already submitted a bid for an order
     * @param {string} orderId
     * @param {string} wholesalerId
     * @returns {Promise<boolean>}
     */
    async hasSubmittedBid(orderId, wholesalerId) {
        const offer = await prisma.vendorOffer.findUnique({
            where: {
                order_id_wholesaler_id: {
                    order_id: orderId,
                    wholesaler_id: wholesalerId
                }
            }
        });
        return offer !== null;
    }
}

module.exports = new VendorOfferService();
