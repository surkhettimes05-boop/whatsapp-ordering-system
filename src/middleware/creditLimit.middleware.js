/**
 * Credit Limit Enforcement Middleware
 * 
 * Enforces credit limits BEFORE order assignment
 * Must be called before finalizing vendor selection
 */

const creditService = require('../services/credit.service');

/**
 * Middleware to check credit limit before order assignment
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {Function} next - Next middleware
 */
async function enforceCreditLimit(req, res, next) {
    try {
        const { retailerId, wholesalerId, orderAmount } = req.body;

        if (!retailerId || !wholesalerId || !orderAmount) {
            return res.status(400).json({
                error: 'Missing required fields: retailerId, wholesalerId, orderAmount'
            });
        }

        // Check credit limit
        const creditCheck = await creditService.checkCreditLimit(
            retailerId,
            wholesalerId,
            Number(orderAmount)
        );

        if (!creditCheck.canPlace) {
            return res.status(403).json({
                error: 'Credit limit exceeded',
                reason: creditCheck.reason,
                currentBalance: creditCheck.currentBalance,
                creditLimit: creditCheck.creditLimit,
                availableCredit: creditCheck.availableCredit
            });
        }

        // Attach credit check result to request for downstream use
        req.creditCheck = creditCheck;
        next();
    } catch (error) {
        console.error('Credit limit middleware error:', error);
        return res.status(500).json({
            error: 'Credit check failed',
            message: error.message
        });
    }
}

/**
 * Service-level credit check (for use in services, not middleware)
 * 
 * @param {string} retailerId
 * @param {string} wholesalerId
 * @param {number} orderAmount
 * @returns {Promise<{canPlace: boolean, reason?: string}>}
 */
async function checkCreditLimitService(retailerId, wholesalerId, orderAmount) {
    const creditCheck = await creditService.checkCreditLimit(
        retailerId,
        wholesalerId,
        Number(orderAmount)
    );

    if (!creditCheck.canPlace) {
        throw new Error(`Credit limit exceeded: ${creditCheck.reason}`);
    }

    return creditCheck;
}

module.exports = {
    enforceCreditLimit,
    checkCreditLimitService
};
