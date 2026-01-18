const prisma = require('../config/database');

class ConversationService {
    /**
     * Get user's current conversation state
     * @param {string} userId 
     * @returns {Object|null} State object or null
     */
    async getState(retailerId) {
        const retailer = await prisma.retailer.findUnique({
            where: { id: retailerId },
            select: { conversationState: true }
        });

        if (retailer && retailer.conversationState) {
            try {
                return JSON.parse(retailer.conversationState);
            } catch (e) {
                console.error('Error parsing conversation state:', e);
                return null;
            }
        }
        return null;
    }

    /**
     * Set retailer's conversation state
     * @param {string} retailerId 
     * @param {string} step - The step name (e.g., 'ORDER_IN_PROGRESS')
     * @param {Object} data - Any context data needed
     */
    async setState(retailerId, step, data = {}) {
        const stateObj = {
            step,
            data,
            updatedAt: new Date().toISOString()
        };

        await prisma.retailer.update({
            where: { id: retailerId },
            data: {
                conversationState: JSON.stringify(stateObj)
            }
        });

        return stateObj;
    }

    /**
     * Clear retailer's conversation state (reset to idle)
     * @param {string} retailerId 
     */
    async clearState(retailerId) {
        await prisma.retailer.update({
            where: { id: retailerId },
            data: {
                conversationState: null
            }
        });
    }
}

module.exports = new ConversationService();
