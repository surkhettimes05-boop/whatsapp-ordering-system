const schedule = require('node-schedule');
const prisma = require('../config/database');
const orderDecisionService = require('../services/orderDecision.service');
const stockService = require('../services/stock.service');
const whatsappService = require('../services/whatsapp.service');
const constants = require('../config/constants');

/**
 * Wholesaler Confirmation Timeout Worker
 * 
 * Monitors orders in WHOLESALER_ACCEPTED status and checks if the winning wholesaler
 * has confirmed within the timeout period. If not, marks offer as FAILED and retries
 * with remaining offers.
 * 
 * Runs every 2 minutes to check for timed-out confirmations
 */
const job = schedule.scheduleJob('*/2 * * * *', async function () {
    console.log('⏰ Running Wholesaler Confirmation Timeout Check...');

    try {
        const timeoutMinutes = constants.WHOLESALER_CONFIRMATION_TIMEOUT_MINUTES || 15;
        const timeoutThreshold = new Date(Date.now() - timeoutMinutes * 60 * 1000);

        // Find orders that are WHOLESALER_ACCEPTED but not yet CONFIRMED
        // and were assigned more than X minutes ago
        const timedOutOrders = await prisma.order.findMany({
            where: {
                status: 'WHOLESALER_ACCEPTED',
                updatedAt: {
                    lt: timeoutThreshold
                },
                confirmedAt: null, // Not yet confirmed
                final_wholesaler_id: { not: null } // Must have an assigned wholesaler
            },
            include: {
                retailer: {
                    select: {
                        id: true,
                        phoneNumber: true,
                        pasalName: true
                    }
                },
                vendorOffers: {
                    include: {
                        wholesaler: {
                            select: {
                                id: true,
                                businessName: true,
                                whatsappNumber: true
                            }
                        }
                    }
                }
            }
        });

        if (timedOutOrders.length === 0) {
            return; // No timed-out orders
        }

        console.log(`⚠️ Found ${timedOutOrders.length} order(s) with timed-out wholesaler confirmations`);

        for (const order of timedOutOrders) {
            try {
                await handleTimedOutConfirmation(order);
            } catch (error) {
                console.error(`❌ Failed to handle timeout for order ${order.id}:`, error.message);
                // Continue with next order even if one fails
            }
        }

    } catch (error) {
        console.error('❌ Error in Wholesaler Confirmation Timeout Job:', error);
    }
});

/**
 * Handle a single timed-out confirmation
 * @param {object} order - Order with related data
 */
async function handleTimedOutConfirmation(order) {
    const orderShortId = order.id.slice(-4);
    
    // Find the winning offer (status ACCEPTED)
    const winningOffer = order.vendorOffers.find(offer => offer.status === 'ACCEPTED');
    
    if (!winningOffer) {
        console.warn(`⚠️ Order ${order.id} has no ACCEPTED offer, skipping`);
        return;
    }

    const failedWholesaler = winningOffer.wholesaler;
    
    console.log(`🔄 Processing timeout for Order #${orderShortId} - Failed wholesaler: ${failedWholesaler.businessName}`);

    // STEP 1: Mark the failed offer as FAILED
    await prisma.vendorOffer.update({
        where: {
            order_id_wholesaler_id: {
                order_id: order.id,
                wholesaler_id: failedWholesaler.id
            }
        },
        data: {
            status: 'EXPIRED' // Using EXPIRED status for timeout
        }
    });

    // STEP 2: Release stock reservations for this order
    try {
        await stockService.releaseStock(order.id);
        console.log(`✅ Released stock reservations for Order #${orderShortId}`);
    } catch (stockError) {
        console.error(`⚠️ Failed to release stock for Order #${orderShortId}:`, stockError.message);
        // Continue anyway - stock release failure shouldn't block retry
    }

    // STEP 3: Remove/void the ledger debit entry (if exists)
    try {
        const ledgerEntry = await prisma.ledgerEntry.findFirst({
            where: {
                orderId: order.id,
                entryType: 'DEBIT',
                retailerId: order.retailerId,
                wholesalerId: failedWholesaler.id
            },
            orderBy: { createdAt: 'desc' }
        });

        if (ledgerEntry) {
            // Create a CREDIT entry to reverse the DEBIT
            const lastEntry = await prisma.ledgerEntry.findFirst({
                where: {
                    retailerId: order.retailerId,
                    wholesalerId: failedWholesaler.id
                },
                orderBy: { createdAt: 'desc' }
            });

            const currentBalance = lastEntry ? Number(lastEntry.balanceAfter) : 0;
            const newBalance = currentBalance - Number(ledgerEntry.amount);

            await prisma.ledgerEntry.create({
                data: {
                    retailerId: order.retailerId,
                    wholesalerId: failedWholesaler.id,
                    orderId: order.id,
                    entryType: 'CREDIT',
                    amount: ledgerEntry.amount,
                    balanceAfter: newBalance,
                    createdBy: 'SYSTEM'
                }
            });
            console.log(`✅ Reversed ledger entry for Order #${orderShortId}`);
        }
    } catch (ledgerError) {
        console.error(`⚠️ Failed to reverse ledger entry for Order #${orderShortId}:`, ledgerError.message);
        // Continue anyway
    }

    // STEP 4: Notify failed wholesaler
    try {
        const timeoutMessage = `⏰ *Confirmation Timeout*

Order #${orderShortId} was not confirmed within ${constants.WHOLESALER_CONFIRMATION_TIMEOUT_MINUTES} minutes.

Your offer has been marked as expired and the order is being reassigned to another vendor.

We appreciate your participation and look forward to future opportunities!`;
        
        await whatsappService.sendMessage(failedWholesaler.whatsappNumber, timeoutMessage);
        console.log(`📱 Timeout notification sent to ${failedWholesaler.businessName}`);
    } catch (notifError) {
        console.error(`⚠️ Failed to notify failed wholesaler:`, notifError.message);
    }

    // STEP 5: Reset order status and retry with remaining offers
    // First, mark all remaining PENDING offers as still eligible
    await prisma.vendorOffer.updateMany({
        where: {
            order_id: order.id,
            status: 'PENDING' // Keep PENDING offers eligible for retry
        },
        data: {
            // No change needed, just ensuring they're still PENDING
        }
    });

    await prisma.order.update({
        where: { id: order.id },
        data: {
            status: 'PENDING_BIDS',
            final_wholesaler_id: null,
            wholesalerId: null,
            updatedAt: new Date() // Reset timestamp for retry
        }
    });

    // STEP 6: Re-run decision engine with remaining offers (excluding failed one)
    console.log(`🔄 Retrying decision engine for Order #${orderShortId} with remaining offers...`);
    
    const retryResult = await orderDecisionService.decideWinner(order.id, {
        adminTriggered: false,
        excludeWholesalerIds: [failedWholesaler.id] // Exclude the failed wholesaler
    });

    if (retryResult.success) {
        console.log(`✅ Successfully reassigned Order #${orderShortId} to ${retryResult.winner.businessName}`);
        
        // Notify retailer about reassignment
        try {
            const retailerMessage = `🔄 *Order Reassignment*

Your Order #${orderShortId} has been reassigned to a new vendor.

*New Wholesaler:* ${retryResult.winner.businessName}
*Price:* Rs. ${retryResult.winner.price}
*Expected Delivery:* ${retryResult.winner.eta}

The previous vendor did not confirm in time.`;
            
            await whatsappService.sendMessage(order.retailer.phoneNumber, retailerMessage);
            console.log(`📱 Reassignment notification sent to retailer`);
        } catch (notifError) {
            console.error(`⚠️ Failed to notify retailer:`, notifError.message);
        }
    } else {
        console.error(`❌ Failed to reassign Order #${orderShortId}: ${retryResult.error}`);
        
        // Notify retailer that reassignment failed
        try {
            const failureMessage = `⚠️ *Order Update*

We were unable to reassign your Order #${orderShortId} after the previous vendor failed to confirm.

Our team will contact you shortly to resolve this. We apologize for the inconvenience.`;
            
            await whatsappService.sendMessage(order.retailer.phoneNumber, failureMessage);
        } catch (notifError) {
            console.error(`⚠️ Failed to notify retailer of failure:`, notifError.message);
        }
    }

    console.log(`✅ Completed timeout handling for Order #${orderShortId}`);
}

module.exports = job;
