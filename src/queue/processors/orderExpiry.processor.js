/**
 * Order Expiry Processor
 * 
 * Processes order expiry jobs using strict state machine
 * - Validates state before transition
 * - Writes all state changes to order_events
 * - Atomically transitions order status
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
                expiresAt: true
            }
        });

        if (!order) {
            throw new Error(`Order ${orderId} not found`);
        }

        // Check if order is already in terminal state
        if (orderStateMachine.TERMINAL_STATES.includes(order.status)) {
            return {
                success: true,
                message: `Order ${orderId} already in terminal state: ${order.status}`,
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

        // Validate transition before attempting
        const validation = await orderStateMachine.validateTransition(
            orderId,
            order.status,
            'CANCELLED'
        );

        if (!validation.valid) {
            return {
                success: false,
                error: validation.error,
                orderId,
                currentStatus: order.status,
                attempted_transition: 'CANCELLED'
            };
        }

        // Cancel expired order with atomic state machine
        // This automatically:
        // 1. Updates order.status
        // 2. Writes to order_events table
        // 3. Logs to AdminAuditLog
        const updatedOrder = await orderStateMachine.transitionOrderStatus(
            orderId,
            'CANCELLED',
            {
                performedBy: 'SYSTEM',
                reason: 'Order expired - no vendor accepted within timeout'
            }
        );

        // Release stock
        await stockService.releaseStock(orderId);

        return {
            success: true,
            orderId,
            previousStatus: order.status,
            newStatus: updatedOrder.status,
            action: 'cancelled',
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error(`Error processing order expiry for ${orderId}:`, error);
        throw error;
    }
}

module.exports = processOrderExpiry;
