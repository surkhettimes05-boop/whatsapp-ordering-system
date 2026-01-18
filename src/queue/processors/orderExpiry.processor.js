/**
 * Order Expiry Processor
 * 
 * Processes order expiry jobs
 */

const prisma = require('../../config/database');
const stockService = require('../../services/stock.service');
const orderStateMachine = require('../../services/orderStateMachine.service');

/**
 * Process order expiry job
 * @param {Job} job - BullMQ job
 * @returns {Promise<object>} - Result
 */
async function processOrderExpiry(job) {
    const { orderId } = job.data;

    if (!orderId) {
        throw new Error('orderId is required');
    }

    try {
        // Get order with lock
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                status: true,
                expiresAt: true,
                final_wholesaler_id: true
            }
        });

        if (!order) {
            throw new Error(`Order ${orderId} not found`);
        }

        // Check if order is already processed
        if (order.status === 'CANCELLED' || order.status === 'DELIVERED' || order.final_wholesaler_id) {
            return {
                success: true,
                message: `Order ${orderId} already processed`,
                skipped: true
            };
        }

        // Check if order has actually expired
        if (order.expiresAt && new Date(order.expiresAt) > new Date()) {
            return {
                success: true,
                message: `Order ${orderId} has not expired yet`,
                skipped: true
            };
        }

        // Cancel expired order
        await orderStateMachine.transitionOrderStatus(
            orderId,
            'CANCELLED',
            {
                performedBy: 'SYSTEM',
                reason: 'Order expired'
            }
        );

        // Release stock
        await stockService.releaseStock(orderId);

        return {
            success: true,
            orderId,
            action: 'cancelled',
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error(`Error processing order expiry for ${orderId}:`, error);
        throw error;
    }
}

module.exports = processOrderExpiry;
