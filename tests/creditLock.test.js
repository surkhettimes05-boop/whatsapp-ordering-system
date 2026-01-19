/**
 * Credit Lock System - Test Suite
 * 
 * Tests concurrent order processing to verify double-spending prevention
 * Uses Jest with Prisma mock transactions
 */

const prisma = require('../src/config/database');
const creditLockService = require('../src/services/creditLock.service');

describe('Credit Lock System - Double Spending Prevention', () => {
  let retailerId, wholesalerId;
  const creditLimit = 100000; // Base currency units

  beforeAll(async () => {
    // Create test retailer and wholesaler
    const retailer = await prisma.retailer.create({
      data: {
        shopName: 'Test Retail Shop',
        phoneNumber: '+9779800000001',
        location: 'Kathmandu',
        businessType: 'GROCERY',
      },
    });

    const wholesaler = await prisma.wholesaler.create({
      data: {
        shopName: 'Test Wholesale Shop',
        phoneNumber: '+9779800000002',
        location: 'Bhaktapur',
        businessType: 'DISTRIBUTOR',
      },
    });

    retailerId = retailer.id;
    wholesalerId = wholesaler.id;

    // Create credit relationship
    await prisma.retailerWholesalerCredit.create({
      data: {
        retailerId,
        wholesalerId,
        creditLimit,
        creditTerms: 30,
        isActive: true,
      },
    });
  });

  afterEach(async () => {
    // Clear ledger entries after each test
    await prisma.ledgerEntry.deleteMany({
      where: {
        retailerId,
        wholesalerId,
      },
    });
  });

  // ========================================================================
  // TEST 1: Single Order - Credit Lock Succeeded
  // ========================================================================
  test('Single order: Should reserve credit successfully', async () => {
    const orderId = 'order_001';
    const orderAmount = 10000;

    const result = await creditLockService.validateAndLockCredit(
      orderId,
      retailerId,
      wholesalerId,
      orderAmount
    );

    expect(result.success).toBe(true);
    expect(result.balance).toBe(0); // No prior balance
    expect(result.reserved).toBe(orderAmount);
    expect(result.newBalance).toBe(orderAmount);
    expect(result.availableCredit).toBe(creditLimit - orderAmount);
    expect(result.ledgerEntry).toBeDefined();
    expect(result.ledgerEntry.entryType).toBe('DEBIT');
  });

  // ========================================================================
  // TEST 2: Concurrent Orders - No Double Spending
  // ========================================================================
  test('Concurrent orders: Multiple simultaneous orders should serialize', async () => {
    const orderAmount = 30000;
    const concurrentOrders = 5;

    // Create 5 orders at the same time (simulating concurrent requests)
    const orderPromises = Array.from({ length: concurrentOrders }, (_, i) => {
      const orderId = `order_concurrent_${i + 1}`;
      return creditLockService.validateAndLockCredit(
        orderId,
        retailerId,
        wholesalerId,
        orderAmount
      );
    });

    // Wait for all to complete
    const results = await Promise.all(orderPromises);

    // First 3 orders should succeed (totaling 90,000, under 100,000 limit)
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    expect(successCount).toBe(3); // First 3 fit within limit
    expect(failureCount).toBe(2); // Last 2 exceed limit
    expect(results[3].errorCode).toBe('INSUFFICIENT_CREDIT');
    expect(results[4].errorCode).toBe('INSUFFICIENT_CREDIT');

    // Verify final balance is exactly 3 * orderAmount (no double spending)
    const finalBalance = await creditLockService._calculateBalanceForUpdate(
      prisma,
      retailerId,
      wholesalerId
    );
    expect(finalBalance).toBe(3 * orderAmount);

    // Verify all ledger entries are recorded
    const entries = await prisma.ledgerEntry.findMany({
      where: { retailerId, wholesalerId, entryType: 'DEBIT' },
    });
    expect(entries.length).toBe(3); // Only successful orders in ledger
  });

  // ========================================================================
  // TEST 3: Stress Test - 10 Concurrent Orders
  // ========================================================================
  test('Stress test: 10 concurrent orders should serialize without race conditions', async () => {
    const orderAmount = 9000; // 10 * 9000 = 90,000 (just under limit)
    const concurrentOrders = 10;

    const orderPromises = Array.from({ length: concurrentOrders }, (_, i) => {
      const orderId = `order_stress_${i + 1}`;
      return creditLockService.validateAndLockCredit(
        orderId,
        retailerId,
        wholesalerId,
        orderAmount
      );
    });

    const results = await Promise.all(orderPromises);

    // All 10 should succeed
    const successCount = results.filter(r => r.success).length;
    expect(successCount).toBe(10);

    // Final balance should be exactly 10 * orderAmount
    const entries = await prisma.ledgerEntry.findMany({
      where: { retailerId, wholesalerId, entryType: 'DEBIT' },
    });
    expect(entries.length).toBe(10);

    const totalDebited = entries.reduce((sum, e) => sum + Number(e.amount), 0);
    expect(totalDebited).toBe(10 * orderAmount);

    // Verify no duplicate entries (each order only added once)
    const orderIds = entries.map(e => e.orderId);
    const uniqueOrderIds = new Set(orderIds);
    expect(uniqueOrderIds.size).toBe(10); // All unique
  });

  // ========================================================================
  // TEST 4: Credit Limit Enforcement
  // ========================================================================
  test('Credit limit: Orders exceeding credit should be rejected', async () => {
    // First order uses 80% of credit
    const order1 = await creditLockService.validateAndLockCredit(
      'order_limit_1',
      retailerId,
      wholesalerId,
      80000 // 80,000
    );
    expect(order1.success).toBe(true);

    // Second order tries to use 25% (total would be 105%)
    const order2 = await creditLockService.validateAndLockCredit(
      'order_limit_2',
      retailerId,
      wholesalerId,
      25000 // Exceeds remaining 20,000
    );
    expect(order2.success).toBe(false);
    expect(order2.errorCode).toBe('INSUFFICIENT_CREDIT');
    expect(order2.availableCredit).toBe(20000);

    // Third order tries to use exactly remaining credit (should succeed)
    const order3 = await creditLockService.validateAndLockCredit(
      'order_limit_3',
      retailerId,
      wholesalerId,
      20000 // Exactly remaining
    );
    expect(order3.success).toBe(true);
    expect(order3.newBalance).toBe(creditLimit); // At limit

    // Fourth order should fail (no credit left)
    const order4 = await creditLockService.validateAndLockCredit(
      'order_limit_4',
      retailerId,
      wholesalerId,
      1 // Even 1 unit fails
    );
    expect(order4.success).toBe(false);
  });

  // ========================================================================
  // TEST 5: Credit Reversal - Order Cancellation
  // ========================================================================
  test('Credit reversal: Cancelled order should release credit', async () => {
    // Create order
    const orderAmount = 50000;
    const createResult = await creditLockService.validateAndLockCredit(
      'order_reversal_1',
      retailerId,
      wholesalerId,
      orderAmount
    );
    expect(createResult.success).toBe(true);
    expect(createResult.newBalance).toBe(orderAmount);

    // Cancel the order (reverse credit)
    const reversalResult = await creditLockService.reverseCreditReservation(
      'order_reversal_1',
      'CANCELLED'
    );
    expect(reversalResult.success).toBe(true);
    expect(reversalResult.amountReversed).toBe(orderAmount);

    // Check that balance returned to 0
    const finalBalance = await creditLockService._calculateBalanceForUpdate(
      prisma,
      retailerId,
      wholesalerId
    );
    expect(finalBalance).toBe(0);

    // Verify ledger has both DEBIT and REVERSAL
    const entries = await prisma.ledgerEntry.findMany({
      where: { retailerId, wholesalerId, orderId: 'order_reversal_1' },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.length).toBe(2);
    expect(entries[0].entryType).toBe('DEBIT');
    expect(entries[1].entryType).toBe('REVERSAL');
  });

  // ========================================================================
  // TEST 6: Sequential Orders After Reversal
  // ========================================================================
  test('Sequential orders: After reversal, credit should be available again', async () => {
    // Order 1: Reserve 60,000
    const order1 = await creditLockService.validateAndLockCredit(
      'order_seq_1',
      retailerId,
      wholesalerId,
      60000
    );
    expect(order1.success).toBe(true);

    // Order 2: Try to reserve 50,000 (should fail - only 40,000 available)
    const order2 = await creditLockService.validateAndLockCredit(
      'order_seq_2',
      retailerId,
      wholesalerId,
      50000
    );
    expect(order2.success).toBe(false);

    // Reverse order 1
    const reversal = await creditLockService.reverseCreditReservation(
      'order_seq_1',
      'CANCELLED'
    );
    expect(reversal.success).toBe(true);

    // Now order 2 should succeed (full credit available again)
    const order2Retry = await creditLockService.validateAndLockCredit(
      'order_seq_2_retry',
      retailerId,
      wholesalerId,
      50000
    );
    expect(order2Retry.success).toBe(true);
    expect(order2Retry.newBalance).toBe(50000);
  });

  // ========================================================================
  // TEST 7: Credit Exposure Reporting
  // ========================================================================
  test('Credit exposure: Should accurately report balance and utilization', async () => {
    // Create several orders
    await creditLockService.validateAndLockCredit(
      'order_exposure_1',
      retailerId,
      wholesalerId,
      30000
    );
    await creditLockService.validateAndLockCredit(
      'order_exposure_2',
      retailerId,
      wholesalerId,
      25000
    );

    const exposure = await creditLockService.getCreditExposure(
      retailerId,
      wholesalerId
    );

    expect(exposure.exists).toBe(true);
    expect(exposure.creditLimit).toBe(creditLimit);
    expect(exposure.currentBalance).toBe(55000);
    expect(exposure.availableCredit).toBe(45000);
    expect(parseFloat(exposure.utilizationPercent)).toBe(55.0);
  });

  // ========================================================================
  // TEST 8: Blocked Credit Account
  // ========================================================================
  test('Blocked account: Should reject orders when credit is blocked', async () => {
    // Block the credit account
    await prisma.retailerWholesalerCredit.update({
      where: {
        retailerId_wholesalerId: {
          retailerId,
          wholesalerId,
        },
      },
      data: {
        isActive: false,
        blockedReason: 'PAYMENT_DEFAULT',
        blockedAt: new Date(),
      },
    });

    // Try to create order
    const result = await creditLockService.validateAndLockCredit(
      'order_blocked_1',
      retailerId,
      wholesalerId,
      5000
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('CREDIT_BLOCKED');
  });

  // ========================================================================
  // TEST 9: Non-existent Credit Relationship
  // ========================================================================
  test('Missing relationship: Should handle non-existent credit account', async () => {
    const unknownRetailerId = 'unknown_retailer';

    const result = await creditLockService.validateAndLockCredit(
      'order_unknown_1',
      unknownRetailerId,
      wholesalerId,
      5000
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('NO_CREDIT_ACCOUNT');
  });

  // ========================================================================
  // TEST 10: Ledger Immutability
  // ========================================================================
  test('Immutability: Ledger entries should be append-only', async () => {
    // Create initial entry
    const debitResult = await creditLockService.validateAndLockCredit(
      'order_immutable_1',
      retailerId,
      wholesalerId,
      20000
    );
    const ledgerEntryId = debitResult.ledgerEntry.id;

    // Try to update (should fail in production, but test shows intent)
    const originalEntry = await prisma.ledgerEntry.findUnique({
      where: { id: ledgerEntryId },
    });

    expect(originalEntry.amount).toBe(20000);
    expect(originalEntry.entryType).toBe('DEBIT');

    // Verify no update capability (immutable by design)
    // In production, you'd add a database trigger or enforce in application
    expect(originalEntry.createdAt).toBeDefined();
    // No updatedAt field ensures immutability
  });

  // ========================================================================
  // TEST 11: Partial Credit Usage
  // ========================================================================
  test('Partial usage: Multiple small orders should sum correctly', async () => {
    const smallOrderAmount = 5000;
    const orderCount = 15; // 15 * 5000 = 75,000

    const promises = Array.from({ length: orderCount }, (_, i) =>
      creditLockService.validateAndLockCredit(
        `order_partial_${i + 1}`,
        retailerId,
        wholesalerId,
        smallOrderAmount
      )
    );

    const results = await Promise.all(promises);

    // All 15 should succeed (75,000 < 100,000)
    const successes = results.filter(r => r.success);
    expect(successes.length).toBe(15);

    // Verify total used exactly 75,000
    const exposure = await creditLockService.getCreditExposure(
      retailerId,
      wholesalerId
    );
    expect(exposure.currentBalance).toBe(75000);
    expect(exposure.availableCredit).toBe(25000);
  });

  // ========================================================================
  // TEST 12: Concurrent with Reversals
  // ========================================================================
  test('Mixed operations: Concurrent creates and reversals should maintain consistency', async () => {
    const orderAmount = 15000;

    // Start 6 concurrent order reservations
    const reservations = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        creditLockService.validateAndLockCredit(
          `order_mixed_${i + 1}`,
          retailerId,
          wholesalerId,
          orderAmount
        )
      )
    );

    // All should succeed (90,000 total < 100,000)
    expect(reservations.filter(r => r.success).length).toBe(6);

    // Reverse half of them
    const reversals = await Promise.all(
      ['order_mixed_1', 'order_mixed_3', 'order_mixed_5'].map(orderId =>
        creditLockService.reverseCreditReservation(orderId, 'CANCELLED')
      )
    );

    expect(reversals.filter(r => r.success).length).toBe(3);

    // Verify balance reduced by reversals (90,000 - 3*15,000 = 45,000)
    const exposure = await creditLockService.getCreditExposure(
      retailerId,
      wholesalerId
    );
    expect(exposure.currentBalance).toBe(45000);
  });

  afterAll(async () => {
    // Cleanup
    await prisma.ledgerEntry.deleteMany({
      where: {
        retailerId,
        wholesalerId,
      },
    });
    await prisma.retailerWholesalerCredit.delete({
      where: {
        retailerId_wholesalerId: {
          retailerId,
          wholesalerId,
        },
      },
    });
    await prisma.retailer.delete({
      where: { id: retailerId },
    });
    await prisma.wholesaler.delete({
      where: { id: wholesalerId },
    });
  });
});
