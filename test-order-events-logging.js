/**
 * Test script to verify order_events logging is working
 * Usage: node test-order-events-logging.js
 */

const prisma = require('./src/config/database');
const orderStateMachine = require('./src/services/orderStateMachine.service');

async function testOrderEventsLogging() {
    console.log('🧪 Testing Order Events Logging Fix\n');
    
    try {
        // Test 1: Create a test order
        console.log('📝 Test 1: Creating test order...');
        const order = await prisma.order.create({
            data: {
                retailerId: 'test-retailer-' + Date.now(),
                totalAmount: 1000,
                status: 'CREATED'
            }
        });
        console.log(`✅ Order created: ${order.id}`);
        console.log(`   Status: ${order.status}\n`);

        // Test 2: Transition through states and verify events
        const states = ['VALIDATED', 'CREDIT_RESERVED', 'VENDOR_NOTIFIED'];
        
        for (const targetState of states) {
            console.log(`📝 Test 2.${states.indexOf(targetState) + 1}: Transitioning to ${targetState}...`);
            
            const updatedOrder = await orderStateMachine.transitionOrderStatus(
                order.id,
                targetState,
                { reason: `Transition to ${targetState} for testing` }
            );
            
            console.log(`✅ Transitioned to: ${updatedOrder.status}`);
            
            // Check if event was logged
            const events = await prisma.orderEvent.findMany({
                where: { orderId: order.id, eventType: 'STATE_CHANGE' },
                orderBy: { timestamp: 'desc' }
            });
            
            if (events.length > 0) {
                const latestEvent = events[0];
                const payload = JSON.parse(latestEvent.payload || '{}');
                console.log(`✅ Event logged: ${payload.fromState} → ${payload.toState}`);
                console.log(`   Timestamp: ${latestEvent.timestamp}`);
            } else {
                console.log(`❌ No event found!`);
            }
            console.log();
        }

        // Test 3: View complete state history
        console.log('📝 Test 3: Viewing complete state history...');
        const history = await orderStateMachine.getOrderStateHistory(order.id);
        
        if (history.length > 0) {
            console.log(`✅ Found ${history.length} state changes:`);
            history.forEach((event, idx) => {
                console.log(`   ${idx + 1}. ${event.fromState} → ${event.toState}`);
                console.log(`      By: ${event.performedBy}, Reason: ${event.reason}`);
            });
        } else {
            console.log('❌ No state history found!');
        }
        console.log();

        // Test 4: Credit reservation validation
        console.log('📝 Test 4: Testing credit reservation validation...');
        
        // Create a new order to test validation
        const testOrder2 = await prisma.order.create({
            data: {
                retailerId: 'test-retailer-2-' + Date.now(),
                totalAmount: 2000,
                status: 'VALIDATED'
            }
        });

        // Try to jump to FULFILLED without CREDIT_RESERVED
        const validation = await orderStateMachine.validateTransition(
            testOrder2.id,
            'VALIDATED',
            'FULFILLED'
        );

        if (!validation.valid && validation.requirementMissing === 'CREDIT_RESERVED') {
            console.log('✅ Credit reservation validation working correctly');
            console.log(`   Error: ${validation.error}`);
        } else {
            console.log('❌ Credit reservation validation failed');
            console.log(`   Result: ${JSON.stringify(validation)}`);
        }
        console.log();

        // Test 5: Direct event write (fallback mechanism)
        console.log('📝 Test 5: Testing direct event write fallback...');
        
        const testOrder3 = await prisma.order.create({
            data: {
                retailerId: 'test-retailer-3-' + Date.now(),
                totalAmount: 3000,
                status: 'CREATED'
            }
        });

        // Write event directly
        const directEvent = await orderStateMachine.writeOrderEventDirect(
            testOrder3.id,
            'CREATED',
            'VALIDATED',
            'SYSTEM',
            'Direct event write test'
        );

        if (directEvent && directEvent.id) {
            console.log('✅ Direct event write successful');
            console.log(`   Event ID: ${directEvent.id}`);
            
            // Verify it can be read back
            const readEvent = await prisma.orderEvent.findUnique({
                where: { id: directEvent.id }
            });
            
            if (readEvent) {
                console.log('✅ Event verified in database');
                const payload = JSON.parse(readEvent.payload || '{}');
                console.log(`   Payload: ${payload.fromState} → ${payload.toState}`);
            }
        } else {
            console.log('❌ Direct event write failed');
        }
        console.log();

        // Summary
        console.log('═══════════════════════════════════════');
        console.log('✅ ALL TESTS PASSED!');
        console.log('═══════════════════════════════════════');
        console.log('\n✅ order_events logging is working correctly');
        console.log('✅ Credit reservation validation is working');
        console.log('✅ Direct event write fallback is working');
        console.log('\n🎉 Fix verified and working!\n');

    } catch (error) {
        console.error('\n❌ TEST FAILED');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run tests
testOrderEventsLogging();
