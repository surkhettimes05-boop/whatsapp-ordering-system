const prisma = require('../../src/config/database');
const orderService = require('../../src/services/order.service');
const assert = require('assert');

// Mock Dependencies
const whatsappService = require('../../src/services/whatsapp.service');
whatsappService.sendMessage = async () => { }; // No-op

async function testRaceCondition() {
    console.log('🏎️  Starting Race Condition Test...');

    // 1. Create a dummy order
    const order = await prisma.order.create({
        data: {
            orderNumber: `RACE-${Date.now()}`,
            retailer: {
                create: {
                    phoneNumber: `RACE-${Date.now()}`,
                    whatsappNumber: `RACE-${Date.now()}`, // Enforced unique
                }
            },
            totalAmount: 1000,
            status: 'PENDING_BIDS'
        }
    });
    console.log(`Created Order: ${order.id}`);

    // 2. Simulate 3 wholesalers trying to accept in parallel
    const wholesalerIds = ['W1', 'W2', 'W3'];

    const promises = wholesalerIds.map(wId =>
        orderService.acceptOrder(order.id, wId)
            .then(res => ({ wId, status: 'won', res }))
            .catch(err => ({ wId, status: 'lost', err: err.message }))
    );

    const results = await Promise.all(promises);

    // 3. Verify Results
    const winners = results.filter(r => r.status === 'won');
    const losers = results.filter(r => r.status === 'lost');

    console.log('Results:', results.map(r => `${r.wId}: ${r.status}`));

    assert.strictEqual(winners.length, 1, 'Only ONE winner should exist');
    assert.strictEqual(losers.length, 2, 'Two should lose');
    assert.ok(losers[0].err.includes('Order already accepted'), 'Error should be "Order already accepted"');

    // 4. Verify DB State
    const finalOrder = await prisma.order.findUnique({ where: { id: order.id } });
    assert.strictEqual(finalOrder.finalWholesalerId, winners[0].wId, 'DB should match winner');
    assert.strictEqual(finalOrder.status, 'WHOLESALER_ACCEPTED', 'Status should be accepted');

    const events = await prisma.orderEvent.findMany({ where: { orderId: order.id } });
    console.log('Events Logged:', events.map(e => e.eventType));
    assert.ok(events.find(e => e.eventType === 'ORDER_LOCKED'), 'Should have lock event');
    assert.ok(events.find(e => e.eventType === 'ACCEPT_ATTEMPT_FAILED'), 'Should have failure events');

    console.log('✅ Race Condition Test Passed');
}

// Run if called directly
if (require.main === module) {
    testRaceCondition()
        .catch(e => {
            console.error('❌ Test Failed:', e);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}
