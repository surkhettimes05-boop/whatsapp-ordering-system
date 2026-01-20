const orderService = require('../../src/services/order.service');
const prisma = require('../../src/config/database');

// Mock Prisma with manual transaction logic simulation
const mockOrder = {
    id: 'race_order_1',
    status: 'PENDING_BIDS',
    finalWholesalerId: null
};

// We need a complex mock to simulate transaction locking or just the logic flow
jest.mock('../../src/config/database', () => {
    const originalModule = jest.requireActual('../../src/config/database');
    return {
        ...originalModule,
        order: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        orderEvent: {
            create: jest.fn()
        },
        $transaction: jest.fn(async (callback) => {
            // Immediately execute callback with "this" (prisma mock)
            // In real app, this wraps in a DB transaction
            return await callback(require('../../src/config/database'));
        })
    };
});

describe('Vendor Race Condition Tests (Mocked Constraints)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mock order state
        mockOrder.status = 'PENDING_BIDS';
        mockOrder.finalWholesalerId = null;
    });

    it('should allow FIRST vendor to claim order', async () => {
        // Setup: Order is free
        prisma.order.findUnique.mockResolvedValue({ ...mockOrder });
        prisma.order.update.mockResolvedValue({ ...mockOrder, finalWholesalerId: 'W1' });

        const result = await orderService.acceptOrder('race_order_1', 'W1');

        expect(result.finalWholesalerId).toBe('W1');
        expect(prisma.orderEvent.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ eventType: 'ORDER_LOCKED' }) })
        );
    });

    it('should REJECT order if finalWholesalerId is already set (Double Booking Prevention)', async () => {
        // Setup: Order ALREADY TAKEN by W1
        const takenOrder = { ...mockOrder, finalWholesalerId: 'W1', status: 'WHOLESALER_ACCEPTED' };
        prisma.order.findUnique.mockResolvedValue(takenOrder);

        // Attempt by W2
        try {
            await orderService.acceptOrder('race_order_1', 'W2');
            fail('Should have thrown error');
        } catch (e) {
            expect(e.message).toContain('Order already accepted');
        }

        expect(prisma.orderEvent.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ eventType: 'ACCEPT_ATTEMPT_FAILED' }) })
        );
        // Ensure NO update occurred
        expect(prisma.order.update).not.toHaveBeenCalled();
    });
});
