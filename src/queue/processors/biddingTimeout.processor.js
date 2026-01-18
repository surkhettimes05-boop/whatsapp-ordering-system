/**
 * Bidding Timeout Processor
 * 
 * Processes bidding timeout jobs (auto-select winner)
 */

const biddingService = require('../../services/bidding.service');

/**
 * Process bidding timeout job
 * @param {Job} job - BullMQ job
 * @returns {Promise<object>} - Result
 */
async function processBiddingTimeout(job) {
    const { orderId } = job.data;

    if (!orderId) {
        throw new Error('orderId is required');
    }

    try {
        const result = await biddingService.autoSelectWinner(orderId);

        return {
            success: result.success,
            orderId,
            winner: result.winner,
            reason: result.reason,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error(`Error processing bidding timeout for ${orderId}:`, error);
        throw error;
    }
}

module.exports = processBiddingTimeout;
