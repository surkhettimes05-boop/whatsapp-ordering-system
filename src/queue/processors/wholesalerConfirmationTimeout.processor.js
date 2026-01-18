/**
 * Wholesaler Confirmation Timeout Processor
 * 
 * Processes wholesaler confirmation timeout jobs
 */

const prisma = require('../../config/database');
const orderDecisionService = require('../../services/orderDecision.service');
const stockService = require('../../services/stock.service');
const ledgerService = require('../../services/ledger.service');
const whatsappService = require('../../services/whatsapp.service');
const constants = require('../../config/constants');

/**
 * Process wholesaler confirmation timeout job
 * @param {Job} job - BullMQ job
 * @returns {Promise<object>} - Result
 */
async function processWholesalerConfirmationTimeout(job) {
    const { orderId } = job.data;

    if (!orderId) {
        throw new Error('orderId is required');
    }

    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                vendorOffers: {
                    where: { status: 'ACCEPTED' },
                    include: { wholesaler: true }
                },
                retailer: true
            }
        });

        if (!order) {
            throw new Error(`Order ${orderId} not found`);
        }

        if (order.status !== 'WHOLESALER_ACCEPTED' || !order.final_wholesaler_id) {
            return {
                success: true,
                message: `Order ${orderId} is not in WHOLESALER_ACCEPTED status`,
                skipped: true
            };
        }

        const winningOffer = order.vendorOffers.find(offer => offer.status === 'ACCEPTED');
        if (!winningOffer) {
            throw new Error(`No winning offer found for order ${orderId}`);
        }

        const timeoutMinutes = constants.WHOLESALER_CONFIRMATION_TIMEOUT_MINUTES || 15;
        const acceptedAt = winningOffer.updatedAt || winningOffer.createdAt;
        const timeoutAt = new Date(acceptedAt.getTime() + timeoutMinutes * 60 * 1000);

        if (new Date() < timeoutAt) {
            return {
                success: true,
                message: `Order ${orderId} confirmation timeout has not expired yet`,
                skipped: true
            };
        }

        const failedWholesaler = winningOffer.wholesaler;

        // Mark offer as EXPIRED
        await prisma.vendorOffer.update({
            where: { id: winningOffer.id },
            data: { status: 'EXPIRED' }
        });

        // Release stock
        await stockService.releaseStock(orderId);

        // Reverse ledger entry
        const ledgerEntry = await prisma.ledgerEntry.findFirst({
            where: {
                orderId,
                entryType: 'DEBIT'
            },
            orderBy: { createdAt: 'desc' }
        });

        if (ledgerEntry) {
            await ledgerService.createCredit(
                order.retailerId,
                failedWholesaler.id,
                Number(ledgerEntry.amount)
            );
        }

        // Notify failed wholesaler
        await whatsappService.sendMessage(
            failedWholesaler.whatsappNumber,
            `⚠️ Your offer for Order #${orderId.slice(-6)} was not confirmed within ${timeoutMinutes} minutes and has been cancelled.`
        );

        // Reset order for retry
        await prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'PENDING_BIDS',
                final_wholesaler_id: null,
                wholesalerId: null,
                updatedAt: new Date()
            }
        });

        // Re-run decision engine
        const retryResult = await orderDecisionService.decideWinner(orderId, {
            adminTriggered: false,
            excludeWholesalerIds: [failedWholesaler.id]
        });

        // Notify retailer
        if (retryResult.winner) {
            await whatsappService.sendMessage(
                order.retailer.phoneNumber,
                `✅ Order #${orderId.slice(-6)} has been reassigned to ${retryResult.winner.businessName}`
            );
        } else {
            await whatsappService.sendMessage(
                order.retailer.phoneNumber,
                `⚠️ Order #${orderId.slice(-6)} could not be reassigned. Please contact support.`
            );
        }

        return {
            success: true,
            orderId,
            failedWholesalerId: failedWholesaler.id,
            retryResult,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error(`Error processing wholesaler confirmation timeout for ${orderId}:`, error);
        throw error;
    }
}

module.exports = processWholesalerConfirmationTimeout;
