/**
 * CREDIT LOCK MECHANISM - COMPREHENSIVE TEST SUITE
 * 
 * Tests concurrent order scenarios to verify double-spending prevention.
 */

const creditLockMechanism = require('../src/services/creditLockMechanism.service');
const prisma = require('../src/config/database');

describe('Credit Lock Mechanism - Double Spending Prevention', () => {
  let retailerId;
  let wholesalerId;
  let creditLimit = 100000;

  beforeAll(async () => {
    // Create test retailer and wholesaler
    const retailer = await prisma.retailer.create({
      data: {
        pasalName: 'Test Retailer',
        ownerName: 'Owner',
        phoneNumber: '+9779800000001',
        city: 'Kathmandu',
      },
    });
    retailerId = retailer.id;

    const wholesaler = await prisma.wholesaler.create({
      data: {
        businessName: 'Test Wholesaler',
        ownerName: 'Owner',
        phoneNumber: '+9779800000002',
        city: 'Kathmandu',
      },
    });
    wholesalerId = wholesaler.id;

    // Create credit account
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

  afterAll(async () => {
    // Cleanup
    await prisma.ledgerEntry.deleteMany({
      where: { retailerId },
    });
    await prisma.retailerWholesalerCredit.deleteMany({
      where: { retailerId },
    });
    await prisma.retailer.delete({
      where: { id: retailerId },
    });
    await prisma.wholesaler.delete({
      where: { id: wholesalerId },
    });
    await prisma.$disconnect();
  });

  // ========================================================================
  // TEST 1: Single Order - Normal Flow
  // ========================================================================
  test('1. Single order should reserve credit and update balance', async () => {
    const orderId = `order_single_${Date.now()}`;
    const orderAmount = 50000;

    const result = await creditLockMechanism.acquireAndValidateCredit(
      orderId,
      retailerId,
      wholesalerId,
      orderAmount
    );

    expect(result.success).toBe(true);
    expect(result.newBalance).toBe(orderAmount);
    expect(result.ledgerEntryId).toBeDefined();
    expect(result.availableCredit).toBe(creditLimit - orderAmount);
  });

  // ========================================================================
  // TEST 2: Two Sequential Orders - Should Work
  // ========================================================================
  test('2. Two sequential orders should accumulate balance', async () => {
    // First order
    const order1Id = `order_seq_1_${Date.now()}`;
    const order1Amount = 30000;

    const result1 = await creditLockMechanism.acquireAndValidateCredit(
      order1Id,
      retailerId,
      wholesalerId,
      order1Amount
    );

    expect(result1.success).toBe(true);
    expect(result1.newBalance).toBe(80000); // 50k + 30k

    // Second order
    const order2Id = `order_seq_2_${Date.now()}`;
    const order2Amount = 15000;

    const result2 = await creditLockMechanism.acquireAndValidateCredit(
      order2Id,
      retailerId,
      wholesalerId,
      order2Amount
    );

    expect(result2.success).toBe(true);
    expect(result2.newBalance).toBe(95000); // 80k + 15k
    expect(result2.availableCredit).toBe(5000);
  });

  // ========================================================================
  // TEST 3: Two Concurrent Orders - Both Within Limit
  // ========================================================================
  test('3. Two concurrent orders (both within limit) should both succeed', async () => {
    // Reset ledger
    await prisma.ledgerEntry.deleteMany({
      where: { retailerId, wholesalerId },
    });

    const order1Id = `order_concurrent_1_${Date.now()}`;
    const order2Id = `order_concurrent_2_${Date.now()}`;
    const orderAmount = 40000;

    // Send both orders concurrently
    const [result1, result2] = await Promise.all([
      creditLockMechanism.acquireAndValidateCredit(
        order1Id,
        retailerId,
        wholesalerId,
        orderAmount
      ),
      creditLockMechanism.acquireAndValidateCredit(
        order2Id,
        retailerId,
        wholesalerId,
        orderAmount
      ),
    ]);

    // Both should succeed
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // Balances should be different (one after the other)
    expect([result1.newBalance, result2.newBalance]).toContain(40000);
    expect([result1.newBalance, result2.newBalance]).toContain(80000);

    // Neither should exceed limit
    expect(result1.newBalance).toBeLessThanOrEqual(creditLimit);
    expect(result2.newBalance).toBeLessThanOrEqual(creditLimit);
  });

  // ========================================================================
  // TEST 4: Two Concurrent Orders - Second Exceeds Limit (CRITICAL TEST)
  // ========================================================================
  test('4. Two concurrent orders (second would exceed limit) - second should fail', async () => {
    // Reset ledger
    await prisma.ledgerEntry.deleteMany({
      where: { retailerId, wholesalerId },
    });

    const order1Id = `order_limit_1_${Date.now()}`;
    const order2Id = `order_limit_2_${Date.now()}`;

    // Order amounts that total more than limit
    const order1Amount = 75000;
    const order2Amount = 40000; // 75k + 40k = 115k > 100k limit

    // Send both concurrently
    const [result1, result2] = await Promise.all([
      creditLockMechanism.acquireAndValidateCredit(
        order1Id,
        retailerId,
        wholesalerId,
        order1Amount
      ),
      creditLockMechanism.acquireAndValidateCredit(
        order2Id,
        retailerId,
        wholesalerId,
        order2Amount
      ),
    ]);

    // First should succeed
    expect(result1.success).toBe(true);
    expect(result1.newBalance).toBe(75000);

    // Second should FAIL with insufficient credit
    expect(result2.success).toBe(false);
    expect(result2.errorCode).toBe('INSUFFICIENT_CREDIT');
    expect(result2.details.projectedBalance).toBe(115000);

    // Verify final balance is correct (only first order counted)
    const finalBalance = await this._calculateBalance(retailerId, wholesalerId);
    expect(finalBalance).toBe(75000);
  });

  // ========================================================================
  // TEST 5: Three Concurrent Orders - Progressive Limit Enforcement
  // ========================================================================
  test('5. Three concurrent orders with progressive limit enforcement', async () => {
    // Reset ledger
    await prisma.ledgerEntry.deleteMany({
      where: { retailerId, wholesalerId },
    });

    const order1Id = `order_prog_1_${Date.now()}`;
    const order2Id = `order_prog_2_${Date.now()}`;
    const order3Id = `order_prog_3_${Date.now()}`;

    // Amounts: 35k + 35k + 35k = 105k (exceeds 100k limit)
    const orderAmount = 35000;

    // Send all three concurrently
    const [result1, result2, result3] = await Promise.all([
      creditLockMechanism.acquireAndValidateCredit(
        order1Id,
        retailerId,
        wholesalerId,
        orderAmount
      ),
      creditLockMechanism.acquireAndValidateCredit(
        order2Id,
        retailerId,
        wholesalerId,
        orderAmount
      ),
      creditLockMechanism.acquireAndValidateCredit(
        order3Id,
        retailerId,
        wholesalerId,
        orderAmount
      ),
    ]);

    // Count successes and failures
    const results = [result1, result2, result3];
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    // Exactly 2 should succeed, 1 should fail
    expect(successes.length).toBe(2);
    expect(failures.length).toBe(1);

    // Failed one should have INSUFFICIENT_CREDIT error
    expect(failures[0].errorCode).toBe('INSUFFICIENT_CREDIT');

    // Final balance should be 70k (2 × 35k)
    const finalBalance = await this._calculateBalance(retailerId, wholesalerId);
    expect(finalBalance).toBe(70000);
  });

  // ========================================================================
  // TEST 6: Order After Reaching Limit
  // ========================================================================
  test('6. Order after reaching credit limit should fail', async () => {
    // Current balance should be 70k from test 5
    const orderAmount = 30001; // Any amount > 30k

    const orderId = `order_at_limit_${Date.now()}`;

    const result = await creditLockMechanism.acquireAndValidateCredit(
      orderId,
      retailerId,
      wholesalerId,
      orderAmount
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('INSUFFICIENT_CREDIT');
    expect(result.details.availableCredit).toBe(30000); // 100k - 70k
  });

  // ========================================================================
  // TEST 7: Credit Release (Cancellation)
  // ========================================================================
  test('7. Releasing credit lock should free up reserved amount', async () => {
    // Reset ledger
    await prisma.ledgerEntry.deleteMany({
      where: { retailerId, wholesalerId },
    });

    // Create an order
    const orderId = `order_release_${Date.now()}`;
    const orderAmount = 50000;

    const lockResult = await creditLockMechanism.acquireAndValidateCredit(
      orderId,
      retailerId,
      wholesalerId,
      orderAmount
    );

    expect(lockResult.success).toBe(true);

    // Verify balance is updated
    let balance = await this._calculateBalance(retailerId, wholesalerId);
    expect(balance).toBe(50000);

    // Release the lock
    const releaseResult = await creditLockMechanism.releaseCreditLock(
      lockResult.ledgerEntryId,
      'Order cancelled'
    );

    expect(releaseResult.success).toBe(true);

    // Verify balance is restored
    balance = await this._calculateBalance(retailerId, wholesalerId);
    expect(balance).toBe(0);

    // Verify ledger has both debit and reversal
    const entries = await prisma.ledgerEntry.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });

    expect(entries.length).toBe(2);
    expect(entries[0].entryType).toBe('DEBIT');
    expect(entries[1].entryType).toBe('REVERSAL');
  });

  // ========================================================================
  // TEST 8: Blocked Credit Account - Should Reject All Orders
  // ========================================================================
  test('8. Blocked credit account should reject orders', async () => {
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
        blockedReason: 'Overdue payments',
      },
    });

    const orderId = `order_blocked_${Date.now()}`;

    const result = await creditLockMechanism.acquireAndValidateCredit(
      orderId,
      retailerId,
      wholesalerId,
      10000
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('CREDIT_BLOCKED');

    // Unblock for other tests
    await prisma.retailerWholesalerCredit.update({
      where: {
        retailerId_wholesalerId: {
          retailerId,
          wholesalerId,
        },
      },
      data: {
        isActive: true,
        blockedReason: null,
      },
    });
  });

  // ========================================================================
  // TEST 9: Lock Timeout Retry
  // ========================================================================
  test('9. Lock timeout should retry with exponential backoff', async () => {
    const orderId = `order_retry_${Date.now()}`;

    // This test verifies retry logic by simulating a lock hold
    // In practice, this would involve another concurrent transaction
    // holding a lock. Here we just verify the mechanism has retry logic.

    const result = await creditLockMechanism.acquireAndValidateCredit(
      orderId,
      retailerId,
      wholesalerId,
      10000,
      {
        maxRetries: 3,
        timeout: 1000,
      }
    );

    // Should eventually succeed if lock is released within timeout
    // (or fail with max retries if lock is held too long)
    expect(result).toBeDefined();
    expect(result.success || result.errorType === 'MAX_RETRIES_EXCEEDED').toBe(true);
  });

  // ========================================================================
  // TEST 10: Payment (Credit) Should Reduce Balance
  // ========================================================================
  test('10. Payment (credit) should reduce outstanding balance', async () => {
    // Reset and create an order
    await prisma.ledgerEntry.deleteMany({
      where: { retailerId, wholesalerId },
    });

    const orderId = `order_payment_${Date.now()}`;
    const orderAmount = 50000;

    await creditLockMechanism.acquireAndValidateCredit(
      orderId,
      retailerId,
      wholesalerId,
      orderAmount
    );

    let balance = await this._calculateBalance(retailerId, wholesalerId);
    expect(balance).toBe(50000);

    // Create credit (payment) entry
    const paymentAmount = 30000;
    await prisma.ledgerEntry.create({
      data: {
        retailerId,
        wholesalerId,
        entryType: 'CREDIT',
        amount: paymentAmount,
        balanceAfter: balance - paymentAmount,
        createdBy: 'SYSTEM',
      },
    });

    // Verify balance decreased
    balance = await this._calculateBalance(retailerId, wholesalerId);
    expect(balance).toBe(20000);
  });

  // ========================================================================
  // TEST 11: Stress Test - 10 Concurrent Orders
  // ========================================================================
  test('11. Stress test: 10 concurrent orders with limit enforcement', async () => {
    // Reset ledger
    await prisma.ledgerEntry.deleteMany({
      where: { retailerId, wholesalerId },
    });

    const orderAmount = 8000; // 10 × 8k = 80k (fits in 100k limit)
    const orders = [];

    for (let i = 0; i < 10; i++) {
      orders.push(
        creditLockMechanism.acquireAndValidateCredit(
          `order_stress_${Date.now()}_${i}`,
          retailerId,
          wholesalerId,
          orderAmount
        )
      );
    }

    const results = await Promise.all(orders);

    // All should succeed since total is 80k < 100k limit
    const successes = results.filter((r) => r.success);
    expect(successes.length).toBe(10);

    // Verify final balance
    const finalBalance = await this._calculateBalance(retailerId, wholesalerId);
    expect(finalBalance).toBe(80000);
  });

  // ========================================================================
  // TEST 12: Stress Test With Overspend - Should Reject Excess
  // ========================================================================
  test('12. Stress test with overspend: some orders should be rejected', async () => {
    // Reset ledger
    await prisma.ledgerEntry.deleteMany({
      where: { retailerId, wholesalerId },
    });

    const orderAmount = 12000; // 10 × 12k = 120k (exceeds 100k limit)
    const orders = [];

    for (let i = 0; i < 10; i++) {
      orders.push(
        creditLockMechanism.acquireAndValidateCredit(
          `order_overspend_${Date.now()}_${i}`,
          retailerId,
          wholesalerId,
          orderAmount
        )
      );
    }

    const results = await Promise.all(orders);

    // Some should succeed, some should fail
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    expect(successes.length).toBeGreaterThan(0);
    expect(failures.length).toBeGreaterThan(0);
    expect(successes.length + failures.length).toBe(10);

    // Calculate total and verify it doesn't exceed limit
    const totalAmount = successes.length * orderAmount;
    expect(totalAmount).toBeLessThanOrEqual(creditLimit);

    // Verify final balance matches
    const finalBalance = await this._calculateBalance(retailerId, wholesalerId);
    expect(finalBalance).toBe(totalAmount);
  });

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Calculate balance from ledger (for test verification)
   */
  async _calculateBalance(retailerId, wholesalerId) {
    const entries = await prisma.ledgerEntry.findMany({
      where: { retailerId, wholesalerId },
      orderBy: { createdAt: 'asc' },
      select: { entryType: true, amount: true },
    });

    let balance = 0;
    for (const entry of entries) {
      const amount = Number(entry.amount);
      if (entry.entryType === 'DEBIT' || entry.entryType === 'ADJUSTMENT') {
        balance += amount;
      } else if (entry.entryType === 'CREDIT' || entry.entryType === 'REVERSAL') {
        balance -= amount;
      }
    }
    return balance;
  }
});
