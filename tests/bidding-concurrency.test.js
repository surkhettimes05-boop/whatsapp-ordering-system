/**
 * Bidding System Concurrency Integration Tests
 * 
 * Tests high-concurrency scenarios:
 * 1. Concurrent bid submissions
 * 2. Race condition in winner selection
 * 3. Auto-expiry processing
 * 4. Audit trail completeness
 * 5. Idempotency guarantees
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();
const biddingService = require('../src/services/bidding.service');

describe('Bidding System - Concurrency & Safety', () => {
    let testRetailerId;
    let testWholesalerIds = [];
    let testOrderId;

    beforeAll(async () => {
        // Create test retailer
        const retailer = await prisma.retailer.create({
            data: {
                pasalName: 'Test Bidding Shop',
                phoneNumber: '9876543210',
                status: 'ACTIVE'
            }
        });
        testRetailerId = retailer.id;

        // Create 5 test wholesalers
        for (let i = 1; i <= 5; i++) {
            const wholesaler = await prisma.wholesaler.create({
                data: {
                    businessName: `Test Wholesaler ${i}`,
                    whatsappNumber: `888888888${i}`,
                    status: 'APPROVED',
                    isVerified: true,
                    reliabilityScore: 50 + (i * 5) // Varying scores
                }
            });
            testWholesalerIds.push(wholesaler.id);
        }
    }, 30000);

    afterAll(async () => {
        // Cleanup
        if (testOrderId) {
            await prisma.vendorOffer.deleteMany({ where: { orderId: testOrderId } });
            await prisma.order.delete({ where: { id: testOrderId } });
        }
        await prisma.wholesaler.deleteMany({ where: { id: { in: testWholesalerIds } } });
        await prisma.retailer.delete({ where: { id: testRetailerId } });
        await prisma.$disconnect();
    });

    beforeEach(async () => {
        // Create fresh order for each test
        const order = await prisma.order.create({
            data: {
                retailerId: testRetailerId,
                totalAmount: 5000,
                status: 'PENDING_BIDS',
                expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes from now
            }
        });
        testOrderId = order.id;
    });

    afterEach(async () => {
        // Clean up order and offers after each test
        if (testOrderId) {
            await prisma.vendorOffer.deleteMany({ where: { orderId: testOrderId } });
            await prisma.order.delete({ where: { id: testOrderId } });
            testOrderId = null;
        }
    });

    test('1. Concurrent Bid Submission - All succeed without conflicts', async () => {
        // Simulate 5 vendors submitting bids simultaneously
        const submissions = testWholesalerIds.map((wholesalerId, index) =>
            biddingService.submitOffer({
                orderId: testOrderId,
                wholesalerId,
                priceQuote: 5000 - (index * 100), // Varying prices
                deliveryEta: `${index + 1}H`,
                stockConfirmed: index % 2 === 0 // Alternating stock confirmation
            })
        );

        const results = await Promise.allSettled(submissions);

        // All should succeed
        const succeeded = results.filter(r => r.status === 'fulfilled');
        expect(succeeded.length).toBe(5);

        // Verify all offers are in database
        const offers = await prisma.vendorOffer.findMany({
            where: { orderId: testOrderId }
        });
        expect(offers.length).toBe(5);
        expect(offers.every(o => o.status === 'PENDING')).toBe(true);
    });

    test('2. Race Condition - Only one winner selected', async () => {
        // Setup: Create 3 offers
        await Promise.all([
            biddingService.submitOffer({
                orderId: testOrderId,
                wholesalerId: testWholesalerIds[0],
                priceQuote: 5000,
                deliveryEta: '2H',
                stockConfirmed: true
            }),
            biddingService.submitOffer({
                orderId: testOrderId,
                wholesalerId: testWholesalerIds[1],
                priceQuote: 4800,
                deliveryEta: '3H',
                stockConfirmed: true
            }),
            biddingService.submitOffer({
                orderId: testOrderId,
                wholesalerId: testWholesalerIds[2],
                priceQuote: 5200,
                deliveryEta: '1H',
                stockConfirmed: false
            })
        ]);

        // Simulate 2 admins clicking "Assign Winner" simultaneously
        const [result1, result2] = await Promise.allSettled([
            biddingService.selectWinner(testOrderId, { performedBy: 'ADMIN_1' }),
            biddingService.selectWinner(testOrderId, { performedBy: 'ADMIN_2' })
        ]);

        // One succeeds, one returns idempotent result (alreadyAssigned: true)
        const fulfilled = [result1, result2].filter(r => r.status === 'fulfilled');
        expect(fulfilled.length).toBe(2); // Both complete, but one is idempotent

        // Check idempotency
        const hasIdempotentResult = fulfilled.some(r => r.value.alreadyAssigned === true);
        expect(hasIdempotentResult).toBe(true);

        // Verify only 1 offer is ACCEPTED
        const acceptedOffers = await prisma.vendorOffer.findMany({
            where: { orderId: testOrderId, status: 'ACCEPTED' }
        });
        expect(acceptedOffers.length).toBe(1);

        // Verify 2 offers are REJECTED
        const rejectedOffers = await prisma.vendorOffer.findMany({
            where: { orderId: testOrderId, status: 'REJECTED' }
        });
        expect(rejectedOffers.length).toBe(2);

        // Verify order has finalWholesalerId set
        const updatedOrder = await prisma.order.findUnique({
            where: { id: testOrderId }
        });
        expect(updatedOrder.finalWholesalerId).toBeTruthy();
        expect(updatedOrder.status).toBe('ASSIGNED');
    });

    test('3. Bid Submission After Winner Selected - Rejected', async () => {
        // Submit initial offer and select winner
        await biddingService.submitOffer({
            orderId: testOrderId,
            wholesalerId: testWholesalerIds[0],
            priceQuote: 5000,
            deliveryEta: '2H',
            stockConfirmed: true
        });

        await biddingService.selectWinner(testOrderId);

        // Try to submit another offer after winner selected
        await expect(
            biddingService.submitOffer({
                orderId: testOrderId,
                wholesalerId: testWholesalerIds[1],
                priceQuote: 4500,
                deliveryEta: '1H',
                stockConfirmed: true
            })
        ).rejects.toThrow('Order already assigned - bidding closed');
    });

    test('4. Auto-Expiry Processing', async () => {
        // Create expired order
        const expiredOrder = await prisma.order.create({
            data: {
                retailerId: testRetailerId,
                totalAmount: 3000,
                status: 'PENDING_BIDS',
                expiresAt: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
            }
        });

        // Submit offers
        await Promise.all([
            biddingService.submitOffer({
                orderId: expiredOrder.id,
                wholesalerId: testWholesalerIds[0],
                priceQuote: 3000,
                deliveryEta: '2H',
                stockConfirmed: true
            }),
            biddingService.submitOffer({
                orderId: expiredOrder.id,
                wholesalerId: testWholesalerIds[1],
                priceQuote: 2900,
                deliveryEta: '3H',
                stockConfirmed: true
            })
        ]);

        // Run auto-expiry
        const results = await biddingService.processExpiredOrders();

        expect(results.processed).toBeGreaterThanOrEqual(1);
        expect(results.succeeded).toBeGreaterThanOrEqual(1);

        // Verify winner was selected
        const updatedOrder = await prisma.order.findUnique({
            where: { id: expiredOrder.id }
        });
        expect(updatedOrder.finalWholesalerId).toBeTruthy();
        expect(updatedOrder.status).toBe('ASSIGNED');

        // Cleanup
        await prisma.vendorOffer.deleteMany({ where: { orderId: expiredOrder.id } });
        await prisma.order.delete({ where: { id: expiredOrder.id } });
    });

    test('5. Audit Trail Completeness', async () => {
        // Submit 2 offers
        await Promise.all([
            biddingService.submitOffer({
                orderId: testOrderId,
                wholesalerId: testWholesalerIds[0],
                priceQuote: 5000,
                deliveryEta: '2H',
                stockConfirmed: true
            }),
            biddingService.submitOffer({
                orderId: testOrderId,
                wholesalerId: testWholesalerIds[1],
                priceQuote: 4800,
                deliveryEta: '1H',
                stockConfirmed: true
            })
        ]);

        // Select winner
        await biddingService.selectWinner(testOrderId);

        // Verify audit logs
        const auditLogs = await prisma.auditLog.findMany({
            where: {
                entity: 'VendorOffer',
                action: { in: ['BID_SUBMITTED', 'BID_ACCEPTED', 'BID_REJECTED', 'WINNER_SELECTED'] }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Should have: 2 BID_SUBMITTED + 1 BID_ACCEPTED + 1 BID_REJECTED + 1 WINNER_SELECTED = 5 events
        expect(auditLogs.length).toBeGreaterThanOrEqual(5);

        const eventTypes = auditLogs.map(log => log.action);
        expect(eventTypes).toContain('BID_SUBMITTED');
        expect(eventTypes).toContain('BID_ACCEPTED');
        expect(eventTypes).toContain('BID_REJECTED');
        expect(eventTypes).toContain('WINNER_SELECTED');
    });

    test('6. Idempotency - Re-running selectWinner returns same result', async () => {
        // Submit offer
        await biddingService.submitOffer({
            orderId: testOrderId,
            wholesalerId: testWholesalerIds[0],
            priceQuote: 5000,
            deliveryEta: '2H',
            stockConfirmed: true
        });

        // Select winner first time
        const result1 = await biddingService.selectWinner(testOrderId);
        expect(result1.winnerId).toBe(testWholesalerIds[0]);
        expect(result1.alreadyAssigned).toBeUndefined();

        // Select winner second time (should be idempotent)
        const result2 = await biddingService.selectWinner(testOrderId);
        expect(result2.winnerId).toBe(testWholesalerIds[0]);
        expect(result2.alreadyAssigned).toBe(true);

        // Verify still only 1 ACCEPTED offer
        const acceptedCount = await prisma.vendorOffer.count({
            where: { orderId: testOrderId, status: 'ACCEPTED' }
        });
        expect(acceptedCount).toBe(1);
    });
});
