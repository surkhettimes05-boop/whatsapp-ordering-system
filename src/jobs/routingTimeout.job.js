const schedule = require('node-schedule');
const prisma = require('../config/database');
const orderRoutingService = require('../services/orderRoutingService');
const whatsappService = require('../services/whatsapp.service');

// Run every minute
const job = schedule.scheduleJob('*/1 * * * *', async function () {
    console.log('⏰ Running Timeout Failover Check...');

    try {
        const timeoutThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

        // Find orders that are PLACED but not yet CONFIRMED (deliveredAt only set on completion)
        // We assume if it's confirmed, status changes to CONFIRMED. 
        // If it's still PLACED after 30 mins, it's ignored.
        const ignoredOrders = await prisma.order.findMany({
            where: {
                status: 'PLACED',
                updatedAt: {
                    lt: timeoutThreshold
                }
            },
            include: {
                items: true,
                retailer: true,
                wholesaler: true
            }
        });

        if (ignoredOrders.length === 0) return;

        console.log(`⚠️ Found ${ignoredOrders.length} ignored/timed-out orders. Re-routing...`);

        for (const order of ignoredOrders) {
            try {
                const oldWholesaler = order.wholesaler;

                // 1. Re-Route (Exclude old wholesaler)
                const result = await orderRoutingService.findBestWholesaler(
                    order.retailerId,
                    order.items,
                    [oldWholesaler.id]
                );

                const newWholesaler = result.selectedWholesaler;

                // 2. Update Order
                await prisma.order.update({
                    where: { id: order.id },
                    data: {
                        wholesalerId: newWholesaler.id,
                        status: 'PLACED', // Reset timestamp effectively
                        // generated updatedAt will update automatically
                    }
                });

                // 3. Record Decision
                await orderRoutingService.recordRoutingDecision(order.id, order.retailerId, result, order.items);

                // 4. Notifications

                // old wholesaler
                await whatsappService.sendMessage(oldWholesaler.whatsappNumber, `🚫 Order #${order.id.slice(-4)} revoked due to timeout.`);

                // New Wholesaler
                const newMsg = `📢 *REROUTED ORDER*\n\nOrder #${order.id.slice(-4)}\nAmount: Rs. ${order.totalAmount}\nRe-assigned due to timeout.\n\nReply "Accept Order ${order.id.slice(-4)}" to claim.`;
                await whatsappService.sendMessage(newWholesaler.whatsappNumber, newMsg);

                // Customer
                await whatsappService.sendMessage(order.retailer.phoneNumber, `ℹ️ Update: Your order has been re-assigned to *${newWholesaler.businessName}* for faster service.`);

                // 5. Update Reliability of old wholesaler
                await orderRoutingService.updateReliabilityScore(oldWholesaler.id, 'TIMEOUT');

                console.log(`✅ successfully re-routed order ${order.id}`);

            } catch (err) {
                console.error(`❌ Failed to re-route order ${order.id}:`, err.message);
                // If fail, maybe notify Admin?
            }
        }
    } catch (e) {
        console.error('Error in Timeout Job:', e);
    }
});

module.exports = job;
