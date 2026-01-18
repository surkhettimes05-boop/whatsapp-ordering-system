/**
 * Bidding Timeout Job
 * 
 * Monitors orders in PENDING_BIDS status and auto-selects winners
 * when bidding window expires
 */

const schedule = require('node-schedule');
const prisma = require('../config/database');
const biddingService = require('../services/bidding.service');

/**
 * Run every 2 minutes to check for expired bidding windows
 */
const job = schedule.scheduleJob('*/2 * * * *', async function () {
    try {
        const now = new Date();
        
        // Find orders with expired bidding windows
        const expiredOrders = await prisma.order.findMany({
            where: {
                status: 'PENDING_BIDS',
                expiresAt: {
                    lte: now
                },
                final_wholesaler_id: null // Not yet assigned
            },
            select: {
                id: true,
                status: true,
                expiresAt: true
            },
            take: 50 // Process in batches
        });

        console.log(`🕐 Bidding Timeout Check: Found ${expiredOrders.length} expired bidding windows`);

        for (const order of expiredOrders) {
            try {
                console.log(`⏰ Auto-selecting winner for order ${order.id.slice(-6)} (bidding expired)`);
                
                const result = await biddingService.autoSelectWinner(order.id);
                
                if (result.success) {
                    console.log(`✅ Auto-selected winner for order ${order.id.slice(-6)}: ${result.winner.businessName}`);
                } else {
                    console.log(`ℹ️ Auto-selection result for order ${order.id.slice(-6)}: ${result.reason}`);
                }
            } catch (error) {
                console.error(`❌ Error auto-selecting winner for order ${order.id}:`, error.message);
            }
        }
    } catch (error) {
        console.error('❌ Bidding timeout job error:', error);
    }
});

console.log('✅ Bidding Timeout Monitor started (runs every 2 minutes)');

module.exports = job;
