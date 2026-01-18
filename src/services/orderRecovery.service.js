const prisma = require('../config/database');
const whatsappService = require('./whatsapp.service');

class OrderRecoveryService {
    /**
     * FEATURE 5: Order Failure & Recovery Flow
     * Create a pending order entry when order placement is initiated
     */
    async createPendingOrder(retailerId, cartItems, totalAmount) {
        // Set expiry to 24 hours from now
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        return prisma.pendingOrder.create({
            data: {
                retailerId,
                cartItems: JSON.stringify(cartItems),
                totalAmount,
                status: 'PENDING',
                expiresAt
            }
        });
    }

    /**
     * Mark a pending order as recovered (user completed the order)
     */
    async markPendingOrderRecovered(pendingOrderId, actualOrderId) {
        return prisma.pendingOrder.update({
            where: { id: pendingOrderId },
            data: {
                status: 'RECOVERED',
                recoveredOrderId: actualOrderId
            }
        });
    }

    /**
     * Check and expire pending orders older than 24 hours
     * This should run as a scheduled job
     */
    async expirePendingOrders() {
        const now = new Date();
        const expired = await prisma.pendingOrder.updateMany({
            where: {
                status: 'PENDING',
                expiresAt: { lt: now }
            },
            data: {
                status: 'EXPIRED'
            }
        });

        console.log(`✅ Expired ${expired.count} pending orders`);
        return expired;
    }

    /**
     * Send follow-up messages to retailers with expired pending orders
     */
    async sendFollowUpMessages() {
        const pendingOrders = await prisma.pendingOrder.findMany({
            where: {
                status: 'EXPIRED',
                followUpSentAt: null
            },
            include: { retailer: true }
        });

        for (const pending of pendingOrders) {
            const message = this.getFollowUpMessage(pending);
            
            try {
                await whatsappService.sendMessage(pending.retailer.phoneNumber, message);
                
                await prisma.pendingOrder.update({
                    where: { id: pending.id },
                    data: { followUpSentAt: new Date() }
                });

                console.log(`✅ Sent follow-up message to ${pending.retailer.phoneNumber}`);
            } catch (error) {
                console.error(`❌ Failed to send follow-up to ${pending.retailer.phoneNumber}:`, error.message);
            }
        }

        return { sent: pendingOrders.length };
    }

    /**
     * Handle order failure (WhatsApp delivery failed, validation error, etc)
     */
    async handleOrderFailure(orderId, failureReason) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { retailer: true }
        });

        if (!order) throw new Error('Order not found');

        // Mark order as failed
        await prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'FAILED',
                failedAt: new Date(),
                failureReason
            }
        });

        // Reverse any credit deductions if this was a CREDIT order
        if (order.paymentMode === 'CREDIT' && order.retailer.credit) {
            const newUsedCredit = Math.max(0, parseFloat(order.retailer.credit.usedCredit) - parseFloat(order.totalAmount));
            await prisma.creditAccount.update({
                where: { retailerId: order.retailer.id },
                data: { usedCredit: newUsedCredit }
            });
        }

        // Send failure notification to retailer
        const message = this.getFailureMessage(order, failureReason);
        try {
            await whatsappService.sendMessage(order.retailer.phoneNumber, message);
        } catch (e) {
            console.error('Error sending failure notification:', e.message);
        }

        return {
            success: true,
            message: `Order ${orderId} marked as failed`,
            reason: failureReason
        };
    }

    /**
     * Generate follow-up message for expired orders
     */
    getFollowUpMessage(pendingOrder) {
        const items = JSON.parse(pendingOrder.cartItems);
        const itemCount = items.length;

        return `👋 *Namaste!*\n\nWe noticed you had a cart with ${itemCount} items (Rs. ${pendingOrder.totalAmount}) but didn't complete the order.\n\n💳 If you'd like to proceed, please start again or reply "View Catalog" to continue shopping.\n\nWe're here to help!`;
    }

    /**
     * Generate failure message for retailer
     */
    getFailureMessage(order, reason) {
        let message = `❌ *Order Failed*\n\nOrder #${order.id.slice(-4)} (Rs. ${order.totalAmount}) could not be processed.\n\n`;
        
        if (reason.includes('CREDIT')) {
            message += `Reason: Insufficient credit available.\n\nYour available credit is lower than needed. Please contact us to increase your limit or try paying via COD.`;
        } else if (reason.includes('VALIDATION')) {
            message += `Reason: Order validation failed.\n\nPlease check your order details and try again.`;
        } else {
            message += `Reason: ${reason}\n\nPlease try placing the order again.`;
        }

        message += `\n\n📞 Need help? Reply with "Support"`;
        return message;
    }

    /**
     * Get pending orders for a retailer
     */
    async getRetailerPendingOrders(retailerId) {
        return prisma.pendingOrder.findMany({
            where: { 
                retailerId,
                status: { in: ['PENDING', 'EXPIRED'] }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Get failed orders for a retailer (last 10)
     */
    async getRetailerFailedOrders(retailerId, limit = 10) {
        return prisma.order.findMany({
            where: {
                retailerId,
                status: 'FAILED'
            },
            orderBy: { failedAt: 'desc' },
            take: limit
        });
    }

    /**
     * Retry failed order (if retailer clicks retry button)
     */
    async retryFailedOrder(orderId) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true, retailer: { include: { credit: true } } }
        });

        if (!order) throw new Error('Order not found');
        if (order.status !== 'FAILED') throw new Error('Order is not in failed state');

        // For CREDIT orders, validate credit availability again
        if (order.paymentMode === 'CREDIT') {
            const availableCredit = parseFloat(order.retailer.credit.creditLimit) - parseFloat(order.retailer.credit.usedCredit);
            if (availableCredit < parseFloat(order.totalAmount)) {
                throw new Error('Insufficient credit for retry');
            }

            // Deduct credit again
            const newUsedCredit = parseFloat(order.retailer.credit.usedCredit) + parseFloat(order.totalAmount);
            await prisma.creditAccount.update({
                where: { retailerId: order.retailer.id },
                data: { usedCredit: newUsedCredit }
            });
        }

        // Reset order status and timestamps
        const retriedOrder = await prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'PLACED',
                failedAt: null,
                failureReason: null,
                updatedAt: new Date()
            }
        });

        return {
            success: true,
            orderId: retriedOrder.id,
            message: `Order ${orderId} has been retried. Status: ${retriedOrder.status}`
        };
    }
}

module.exports = new OrderRecoveryService();
