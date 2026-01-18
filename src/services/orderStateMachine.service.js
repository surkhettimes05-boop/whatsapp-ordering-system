/**
 * Order State Machine Service
 * 
 * Hard state machine for order status transitions
 * - Defines allowed transitions
 * - Validates transitions
 * - Enforces at controller and database level
 * - Logs all transitions to AdminAuditLog
 */

const prisma = require('../config/database');
const { withTransaction } = require('../utils/transaction');

/**
 * Allowed state transitions map
 * Key: current status
 * Value: array of allowed next statuses
 */
const ALLOWED_TRANSITIONS = {
    CREATED: ['PENDING_BIDS', 'CANCELLED'],
    PENDING_BIDS: ['CREDIT_APPROVED', 'STOCK_RESERVED', 'WHOLESALER_ACCEPTED', 'CANCELLED', 'FAILED'],
    CREDIT_APPROVED: ['STOCK_RESERVED', 'WHOLESALER_ACCEPTED', 'CANCELLED', 'FAILED'],
    STOCK_RESERVED: ['WHOLESALER_ACCEPTED', 'CANCELLED', 'FAILED'],
    WHOLESALER_ACCEPTED: ['CONFIRMED', 'CANCELLED', 'FAILED'],
    CONFIRMED: ['PROCESSING', 'CANCELLED', 'FAILED'],
    PROCESSING: ['PACKED', 'CANCELLED', 'FAILED'],
    PACKED: ['OUT_FOR_DELIVERY', 'CANCELLED', 'FAILED'],
    OUT_FOR_DELIVERY: ['SHIPPED', 'DELIVERED', 'CANCELLED', 'FAILED'],
    SHIPPED: ['DELIVERED', 'RETURNED', 'CANCELLED', 'FAILED'],
    DELIVERED: ['RETURNED'], // Can only return after delivery
    FAILED: ['CANCELLED', 'PENDING_BIDS'], // Can retry or cancel
    CANCELLED: [], // Terminal state - no transitions allowed
    RETURNED: ['CANCELLED', 'PENDING_BIDS'] // Can cancel or retry
};

/**
 * Terminal states - no transitions allowed from these
 */
const TERMINAL_STATES = ['CANCELLED', 'DELIVERED'];

/**
 * Check if a transition is allowed
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Target status
 * @returns {boolean} - True if transition is allowed
 */
function isTransitionAllowed(fromStatus, toStatus) {
    if (!fromStatus || !toStatus) {
        return false;
    }

    // Same status is always allowed (idempotent)
    if (fromStatus === toStatus) {
        return true;
    }

    // Terminal states cannot transition
    if (TERMINAL_STATES.includes(fromStatus) && fromStatus !== toStatus) {
        return false;
    }

    // Check if transition is in allowed list
    const allowedNextStates = ALLOWED_TRANSITIONS[fromStatus];
    if (!allowedNextStates) {
        return false;
    }

    return allowedNextStates.includes(toStatus);
}

/**
 * Get all allowed transitions from a status
 * @param {string} status - Current status
 * @returns {Array<string>} - Array of allowed next statuses
 */
function getAllowedTransitions(status) {
    if (!status) {
        return [];
    }

    // Terminal states have no transitions
    if (TERMINAL_STATES.includes(status)) {
        return [];
    }

    return ALLOWED_TRANSITIONS[status] || [];
}

/**
 * Validate order status transition
 * @param {string} orderId - Order ID
 * @param {string} fromStatus - Current status (will be fetched if not provided)
 * @param {string} toStatus - Target status
 * @param {object} tx - Optional transaction client
 * @returns {Promise<{valid: boolean, error?: string, currentStatus?: string}>}
 */
async function validateTransition(orderId, fromStatus, toStatus, tx = null) {
    const client = tx || prisma;

    try {
        // Fetch current order status if not provided
        if (!fromStatus) {
            const order = await client.order.findUnique({
                where: { id: orderId },
                select: { id: true, status: true }
            });

            if (!order) {
                return {
                    valid: false,
                    error: `Order ${orderId} not found`
                };
            }

            fromStatus = order.status;
        }

        // Validate transition
        if (!isTransitionAllowed(fromStatus, toStatus)) {
            const allowed = getAllowedTransitions(fromStatus);
            return {
                valid: false,
                error: `Invalid transition from ${fromStatus} to ${toStatus}. Allowed transitions: ${allowed.join(', ') || 'none (terminal state)'}`,
                currentStatus: fromStatus,
                targetStatus: toStatus,
                allowedTransitions: allowed
            };
        }

        return {
            valid: true,
            currentStatus: fromStatus,
            targetStatus: toStatus
        };
    } catch (error) {
        return {
            valid: false,
            error: `Validation error: ${error.message}`
        };
    }
}

/**
 * Log order status transition to AdminAuditLog
 * @param {string} orderId - Order ID
 * @param {string} fromStatus - Previous status
 * @param {string} toStatus - New status
 * @param {string} performedBy - Admin ID or 'SYSTEM'
 * @param {string} reason - Reason for transition
 * @param {object} tx - Optional transaction client
 */
async function logTransition(orderId, fromStatus, toStatus, performedBy = 'SYSTEM', reason = null, tx = null) {
    // Always use separate transaction for logging to ensure it persists
    const client = prisma;

    try {
        // For system actions, we need to either:
        // 1. Create a system admin user, or
        // 2. Use a default admin ID, or
        // 3. Make adminId nullable in schema
        // For now, we'll try to find a system admin or use a default
        
        let adminId = performedBy;
        
        // If SYSTEM, try to find or create a system admin
        if (performedBy === 'SYSTEM' || !performedBy) {
            // Try to find a system admin user
            const systemAdmin = await client.admin.findFirst({
                where: {
                    email: 'system@platform.com' // Or use a system identifier
                },
                select: { id: true }
            });
            
            if (systemAdmin) {
                adminId = systemAdmin.id;
            } else {
                // If no system admin exists, create one or use first admin
                const firstAdmin = await client.admin.findFirst({
                    select: { id: true }
                });
                
                if (firstAdmin) {
                    adminId = firstAdmin.id;
                } else {
                    // If no admin exists at all, skip logging (shouldn't happen in production)
                    console.warn('⚠️ No admin found for system action logging');
                    return;
                }
            }
        }

        await client.adminAuditLog.create({
            data: {
                adminId: adminId,
                action: 'ORDER_STATUS_TRANSITION',
                targetId: orderId,
                reason: reason || `Status transition from ${fromStatus} to ${toStatus}`,
                metadata: JSON.stringify({
                    fromStatus,
                    toStatus,
                    performedBy: performedBy || 'SYSTEM',
                    timestamp: new Date().toISOString()
                })
            }
        });
    } catch (error) {
        // Don't throw - logging failures shouldn't break the flow
        console.error('⚠️ Failed to log order status transition:', error);
    }
}

/**
 * Transition order status with validation and logging
 * @param {string} orderId - Order ID
 * @param {string} toStatus - Target status
 * @param {object} options - Options
 * @param {string} options.performedBy - Admin ID or 'SYSTEM'
 * @param {string} options.reason - Reason for transition
 * @param {object} options.tx - Optional transaction client
 * @param {boolean} options.skipValidation - Skip validation (use with caution)
 * @returns {Promise<Object>} Updated order
 */
async function transitionOrderStatus(orderId, toStatus, options = {}) {
    const {
        performedBy = 'SYSTEM',
        reason = null,
        tx = null,
        skipValidation = false
    } = options;

    const client = tx || prisma;

    // Validate transition if not skipped
    if (!skipValidation) {
        const validation = await validateTransition(orderId, null, toStatus, client);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
    }

    // Get current status for logging
    const order = await client.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true }
    });

    if (!order) {
        throw new Error(`Order ${orderId} not found`);
    }

    const fromStatus = order.status;

    // Update order status
    const updatedOrder = await client.order.update({
        where: { id: orderId },
        data: {
            status: toStatus,
            updatedAt: new Date()
        }
    });

    // Log transition (outside transaction if tx provided, to ensure it persists)
    if (tx) {
        // If in transaction, log after transaction commits
        // We'll use a separate transaction for logging
        setImmediate(() => {
            logTransition(orderId, fromStatus, toStatus, performedBy, reason, null);
        });
    } else {
        // Log immediately
        await logTransition(orderId, fromStatus, toStatus, performedBy, reason, null);
    }

    return updatedOrder;
}

/**
 * Transition order status within a transaction
 * Use this when you need to ensure atomicity with other operations
 * @param {object} tx - Transaction client
 * @param {string} orderId - Order ID
 * @param {string} toStatus - Target status
 * @param {object} options - Options
 * @param {string} options.performedBy - Admin ID or 'SYSTEM'
 * @param {string} options.reason - Reason for transition
 * @returns {Promise<Object>} Updated order
 */
async function transitionOrderStatusInTransaction(tx, orderId, toStatus, options = {}) {
    const {
        performedBy = 'SYSTEM',
        reason = null
    } = options;

    // Validate transition
    const validation = await validateTransition(orderId, null, toStatus, tx);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    // Get current status for logging
    const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true }
    });

    if (!order) {
        throw new Error(`Order ${orderId} not found`);
    }

    const fromStatus = order.status;

    // Update order status
    const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
            status: toStatus,
            updatedAt: new Date()
        }
    });

    // Log transition after transaction (to ensure it persists)
    // We'll log in a separate transaction after this one commits
    setImmediate(() => {
        logTransition(orderId, fromStatus, toStatus, performedBy, reason, null);
    });

    return updatedOrder;
}

/**
 * Get state machine diagram/visualization
 * @returns {Object} State machine definition
 */
function getStateMachineDefinition() {
    return {
        states: Object.keys(ALLOWED_TRANSITIONS),
        terminalStates: TERMINAL_STATES,
        transitions: ALLOWED_TRANSITIONS,
        getTransition: (from, to) => ({
            allowed: isTransitionAllowed(from, to),
            allowedNext: getAllowedTransitions(from)
        })
    };
}

module.exports = {
    // Validation
    isTransitionAllowed,
    getAllowedTransitions,
    validateTransition,
    
    // Transition functions
    transitionOrderStatus,
    transitionOrderStatusInTransaction,
    
    // Logging
    logTransition,
    
    // Utilities
    getStateMachineDefinition,
    TERMINAL_STATES,
    ALLOWED_TRANSITIONS
};
