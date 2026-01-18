/**
 * Order State Validation Middleware
 * 
 * Validates order status transitions at the controller level
 * Provides early validation before service layer
 */

const orderStateMachine = require('../services/orderStateMachine.service');

/**
 * Middleware to validate order status transition
 * Attaches validation result to request object
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {Function} next - Next middleware
 */
async function validateOrderTransition(req, res, next) {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                error: 'Status is required',
                type: 'VALIDATION_ERROR'
            });
        }

        // Validate transition (will fetch current status)
        const validation = await orderStateMachine.validateTransition(id, null, status);

        if (!validation.valid) {
            return res.status(400).json({
                error: validation.error,
                type: 'STATE_MACHINE_VALIDATION_ERROR',
                currentStatus: validation.currentStatus,
                targetStatus: validation.targetStatus,
                allowedTransitions: validation.allowedTransitions
            });
        }

        // Attach validation result to request
        req.orderTransition = validation;
        next();
    } catch (error) {
        console.error('Order state validation middleware error:', error);
        return res.status(500).json({
            error: 'State validation failed',
            message: error.message
        });
    }
}

/**
 * Get allowed transitions for an order
 * GET /api/v1/orders/:id/transitions
 */
async function getAllowedTransitions(req, res) {
    try {
        const { id } = req.params;
        const prisma = require('../config/database');

        const order = await prisma.order.findUnique({
            where: { id },
            select: { id: true, status: true }
        });

        if (!order) {
            return res.status(404).json({
                error: 'Order not found'
            });
        }

        const allowed = orderStateMachine.getAllowedTransitions(order.status);
        const isTerminal = orderStateMachine.TERMINAL_STATES.includes(order.status);

        res.json({
            orderId: id,
            currentStatus: order.status,
            isTerminal,
            allowedTransitions: allowed,
            stateMachine: orderStateMachine.getStateMachineDefinition()
        });
    } catch (error) {
        console.error('Error getting allowed transitions:', error);
        res.status(500).json({
            error: 'Failed to get allowed transitions',
            message: error.message
        });
    }
}

module.exports = {
    validateOrderTransition,
    getAllowedTransitions
};
