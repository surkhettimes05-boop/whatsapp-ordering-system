const vendorOfferService = require('../services/vendorOffer.service');

/**
 * Vendor Offer Controller
 * Handles HTTP endpoints for vendor offer management
 */
class VendorOfferController {
    /**
     * Get all offers for a specific order
     * GET /api/v1/vendor-offers/:orderId
     */
    async getOrderOffers(req, res) {
        try {
            const { orderId } = req.params;

            const offers = await vendorOfferService.getOffersForOrder(orderId);

            res.json({
                success: true,
                data: offers,
                count: offers.length
            });

        } catch (error) {
            console.error('Error fetching order offers:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch offers'
            });
        }
    }

    /**
     * Get the best offer for an order
     * GET /api/v1/vendor-offers/:orderId/best
     */
    async getBestOffer(req, res) {
        try {
            const { orderId } = req.params;

            const bestOffer = await vendorOfferService.getBestOffer(orderId);

            if (!bestOffer) {
                return res.status(404).json({
                    success: false,
                    message: 'No offers found for this order'
                });
            }

            res.json({
                success: true,
                data: bestOffer
            });

        } catch (error) {
            console.error('Error fetching best offer:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch best offer'
            });
        }
    }

    /**
     * Submit a vendor offer (for testing/API access)
     * POST /api/v1/vendor-offers
     * Body: { wholesalerId, orderId, price, eta }
     */
    async submitOffer(req, res) {
        try {
            const { wholesalerId, orderId, price, eta } = req.body;

            // Validate required fields
            if (!wholesalerId || !orderId || !price || !eta) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: wholesalerId, orderId, price, eta'
                });
            }

            // Construct a message in the expected format
            const message = `PRICE ${price} ETA ${eta}`;

            const result = await vendorOfferService.processIncomingBid(wholesalerId, message);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json(result);

        } catch (error) {
            console.error('Error submitting offer:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to submit offer'
            });
        }
    }

    /**
     * Check if a wholesaler has submitted a bid
     * GET /api/v1/vendor-offers/:orderId/check/:wholesalerId
     */
    async checkBidStatus(req, res) {
        try {
            const { orderId, wholesalerId } = req.params;

            const hasSubmitted = await vendorOfferService.hasSubmittedBid(orderId, wholesalerId);

            res.json({
                success: true,
                hasSubmittedBid: hasSubmitted
            });

        } catch (error) {
            console.error('Error checking bid status:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to check bid status'
            });
        }
    }
}

module.exports = new VendorOfferController();
