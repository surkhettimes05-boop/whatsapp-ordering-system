/**
 * Vendor Fallback Processor
 * 
 * Processes vendor fallback jobs (when primary vendor fails)
 */

const orderDecisionService = require('../../services/orderDecision.service');
const prisma = require('../../config/database');

/**
 * Process vendor fallback job
 * @param {Job} job - BullMQ job
 * @returns {Promise<object>} - Result
 */
async function processVendorFallback(job) {
    const { orderId, excludeWholesalerIds = [] } = job.data;

    if (!orderId) {
        throw new Error('orderId is required');
    }

    try {
        // Get order
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                status: true,
                final_wholesaler_id: true
            }
        });

        if (!order) {
            throw new Error(`Order ${orderId} not found`);
        }

        // Check if order already has a winner
        if (order.final_wholesaler_id) {
            return {
                success: true,
                message: `Order ${orderId} already has a winner`,
                skipped: true
            };
        }

        // Re-run decision engine with excluded wholesalers
        const result = await orderDecisionService.decideWinner(orderId, {
            adminTriggered: false,
            excludeWholesalerIds
        });

        return {
            success: true,
            orderId,
            winner: result.winner,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error(`Error processing vendor fallback for ${orderId}:`, error);
        throw error;
    }
}

module.exports = processVendorFallback;
