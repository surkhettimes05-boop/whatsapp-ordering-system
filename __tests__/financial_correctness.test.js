/* eslint-env jest */
const prisma = require('../src/config/database');
const creditService = require('../src/services/credit.service');
const ledgerService = require('../src/services/ledger.service');
const orderDecisionEngine = require('../src/services/orderDecision.service');

// Helper to reset mock store when running in test mode
async function resetStore() {
    if (prisma.__store__) {
        Object.keys(prisma.__store__).forEach(k => {
            if (k === '__counters__') return;
            prisma.__store__[k] = {};
        });
        prisma.__store__.__counters__ = {};
    } else {
        // In real DB, clean up tables
        await prisma.$transaction([
            prisma.ledgerEntry.deleteMany(),
            prisma.retailerWholesalerCredit.deleteMany(),
            prisma.orderItem.deleteMany(),
            prisma.order.deleteMany(),
            prisma.vendorOffer.deleteMany(),
            prisma.wholesalerProduct.deleteMany(),
            prisma.product.deleteMany(),
            prisma.category.deleteMany(),
            prisma.retailer.deleteMany(),
            prisma.wholesaler.deleteMany(),
            prisma.user.deleteMany()
        ]);
    }
}

describe('Financial Correctness Test Suite', () => {
    let retailer, wholesaler, product, creditRelation;

    beforeEach(async () => {
        // Force test environment to use mock if configured that way
        process.env.NODE_ENV = 'test';
        await resetStore();

        // 1. Create seed data
        const category = await prisma.category.create({ data: { name: 'Test Category' } });
        product = await prisma.product.create({
            data: {
                name: 'Test Product',
                categoryId: category.id,
                fixedPrice: 100,
                unit: 'kg'
            }
        });

        retailer = await prisma.retailer.create({
            data: {
                pasalName: 'Test Retailer',
                phoneNumber: '9800000001',
                status: 'ACTIVE'
            }
        });

        wholesaler = await prisma.wholesaler.create({
            data: {
                businessName: 'Test Wholesaler',
                ownerName: 'Owner',
                phoneNumber: '9800000002',
                whatsappNumber: '9800000002',
                businessAddress: 'Addr',
                city: 'KTM',
                state: 'Bagmati',
                pincode: '44600',
                latitude: 27.7,
                longitude: 85.3,
                categories: 'Test Category'
            }
        });

        await prisma.wholesalerProduct.create({
            data: {
                wholesalerId: wholesaler.id,
                productId: product.id,
                priceOffered: 100,
                stock: 1000,
                isAvailable: true
            }
        });

        creditRelation = await prisma.retailerWholesalerCredit.create({
            data: {
                retailerId: retailer.id,
                wholesalerId: wholesaler.id,
                creditLimit: 1000,
                isActive: true
            }
        });
    });

    /**
     * Requirement 1: Ledger cannot be modified or deleted
     */
    test('1. Ledger cannot be modified or deleted', async () => {
        const entry = await prisma.ledgerEntry.create({
            data: {
                retailerId: retailer.id,
                wholesalerId: wholesaler.id,
                entryType: 'DEBIT',
                amount: 500,
                balanceAfter: 500,
                createdBy: 'SYSTEM'
            }
        });

        // Try to update - should fail
        await expect(prisma.ledgerEntry.update({
            where: { id: entry.id },
            data: { amount: 100 }
        })).rejects.toThrow();

        // Try to delete - should fail
        await expect(prisma.ledgerEntry.delete({
            where: { id: entry.id }
        })).rejects.toThrow();

        // Verify entry still exists and is unchanged
        const verifiedEntry = await prisma.ledgerEntry.findUnique({
            where: { id: entry.id }
        });
        expect(Number(verifiedEntry.amount)).toBe(500);
    });

    /**
     * Requirement 2: Balance always equals sum(ledger entries)
     */
    test('2. Balance always equals sum(ledger entries)', async () => {
        // Create a sequence of entries
        const entries = [
            { type: 'DEBIT', amount: 300 },
            { type: 'DEBIT', amount: 200 },
            { type: 'CREDIT', amount: 100 },
            { type: 'ADJUSTMENT', amount: 50 }, // Positive adjustment adds to debt
            { type: 'REVERSAL', amount: 50 }    // Reversal subtracts from debt
        ];

        let runningBalance = 0;
        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            if (e.type === 'DEBIT' || e.type === 'ADJUSTMENT') runningBalance += e.amount;
            else if (e.type === 'CREDIT' || e.type === 'REVERSAL') runningBalance -= e.amount;

            await prisma.ledgerEntry.create({
                data: {
                    retailerId: retailer.id,
                    wholesalerId: wholesaler.id,
                    entryType: e.type,
                    amount: e.amount,
                    balanceAfter: runningBalance,
                    createdBy: 'SYSTEM',
                    createdAt: new Date(Date.now() + i * 1000) // Ensure unique timestamps
                }
            });
        }

        const calculatedBalance = await creditService.calculateBalance(retailer.id, wholesaler.id);
        const lastEntryBalance = await ledgerService.getBalance(retailer.id, wholesaler.id);

        expect(calculatedBalance).toBe(400); // 300+200-100+50-50 = 400
        expect(lastEntryBalance).toBe(400);
        expect(calculatedBalance).toBe(lastEntryBalance);
    });

    /**
     * Requirement 3: Credit limit blocks assignment
     */
    test('3. Credit limit blocks assignment', async () => {
        // 1. Create an order with total amount exceeding limit (Limit is 1000)
        const order = await prisma.order.create({
            data: {
                retailerId: retailer.id,
                totalAmount: 1500,
                paymentMode: 'CREDIT',
                status: 'PENDING_BIDS'
            }
        });

        await prisma.orderItem.create({
            data: {
                orderId: order.id,
                productId: product.id,
                quantity: 15,
                priceAtOrder: 100
            }
        });

        // 2. Create a vendor offer
        await prisma.vendorOffer.create({
            data: {
                order_id: order.id,
                wholesaler_id: wholesaler.id,
                price_quote: 1500,
                delivery_eta: '2H',
                stock_confirmed: true,
                status: 'PENDING'
            }
        });

        // 3. Attempt to decide winner
        const result = await orderDecisionEngine.decideWinner(order.id);

        // 4. Verify failure
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Credit limit exceeded/);

        // 5. Verify order status hasn't changed to WHOLESALER_ACCEPTED
        const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
        expect(updatedOrder.status).toBe('PENDING_BIDS');
        expect(updatedOrder.final_wholesaler_id).toBeNull();
    });

    /**
     * Requirement 4: Concurrent orders do not overdraw credit
     */
    test('4. Concurrent orders do not overdraw credit', async () => {
        // Limit is 1000. Current balance is 0.
        // We will trigger two orders of 600 each simultaneously.
        // Only one should succeed.

        const createOrderWithOffer = async (amount, suffix) => {
            const order = await prisma.order.create({
                data: {
                    retailerId: retailer.id,
                    totalAmount: amount,
                    paymentMode: 'CREDIT',
                    status: 'PENDING_BIDS'
                }
            });
            await prisma.orderItem.create({
                data: {
                    orderId: order.id,
                    productId: product.id,
                    quantity: amount / 100,
                    priceAtOrder: 100
                }
            });
            await prisma.vendorOffer.create({
                data: {
                    order_id: order.id,
                    wholesaler_id: wholesaler.id,
                    price_quote: amount,
                    delivery_eta: '1H',
                    stock_confirmed: true,
                    status: 'PENDING'
                }
            });
            return order.id;
        };

        const orderId1 = await createOrderWithOffer(600, 'A');
        const orderId2 = await createOrderWithOffer(600, 'B');

        // Trigger concurrently
        const results = await Promise.all([
            orderDecisionEngine.decideWinner(orderId1),
            orderDecisionEngine.decideWinner(orderId2)
        ]);

        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        // Verify only one succeeded
        expect(successful.length).toBe(1);
        expect(failed.length).toBe(1);
        expect(failed[0].error).toMatch(/Credit limit exceeded|serialize access/);

        // Verify final balance is 600, not 1200
        const finalBalance = await creditService.calculateBalance(retailer.id, wholesaler.id);
        expect(finalBalance).toBe(600);
    }, 15000); // Higher timeout for concurrent test
});
