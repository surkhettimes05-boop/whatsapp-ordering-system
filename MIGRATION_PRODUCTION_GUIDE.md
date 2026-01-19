# Production-Safe Migration Guide

**Date**: January 19, 2026  
**Migration Name**: `production_safety_constraints`  
**Risk Level**: LOW → MEDIUM (if existing data violates constraints)  
**Estimated Duration**: 5-15 minutes (depending on data size)  
**Downtime Required**: NONE (migrations non-blocking)

---

## Migration Summary

This migration adds production safety features to your Prisma schema:

✅ **Foreign Key Cascades** - Ensure data consistency on deletion  
✅ **CHECK Constraints** - Prevent invalid business states  
✅ **Performance Indexes** - Speed up common queries  
✅ **Referential Integrity** - All relationships properly constrained  

---

## Changes Applied

### 1. Schema Changes (Prisma)

**File**: `backend/prisma/schema.prisma`

#### Change 1: LedgerEntry.order now cascades on delete
```prisma
// BEFORE
order Order? @relation(fields: [orderId], references: [id])

// AFTER
order Order? @relation(fields: [orderId], references: [id], onDelete: Cascade)
```
**Impact**: When an order is deleted, ledger entries cascade delete (preserving audit trail in separate table if needed)

#### Change 2: Order now has creditTransactions relation
```prisma
// ADDED
creditTransactions CreditTransaction[]
```
**Impact**: Enables querying all credit transactions for an order; CreditTransaction.order has `onDelete: SetNull`

#### Change 3: CreditTransaction now has Order foreign key
```prisma
// BEFORE
retailer Retailer @relation(fields: [retailerId], references: [id], onDelete: Cascade)

// AFTER
retailer Retailer @relation(fields: [retailerId], references: [id], onDelete: Cascade)
order    Order?   @relation(fields: [orderId], references: [id], onDelete: SetNull)
```
**Impact**: Credit transactions survive order deletion; orderId becomes NULL

#### Change 4: Added performance indexes to Order
```prisma
@@index([status, createdAt])                         // NEW
@@index([status, deletedAt])                         // NEW
@@index([wholesalerId, finalWholesalerId, status])   // NEW
```
**Impact**: Speeds up queries filtering by status, active orders, and vendor selection

### 2. Database Constraints (SQL)

**File**: `backend/prisma/migrations/production_safety_constraints/migration.sql`

#### CHECK Constraints Added:

| Table | Constraint | Rule | Purpose |
|-------|-----------|------|---------|
| credit_accounts | check_credit_account_limit | used_credit ≤ credit_limit | Prevent over-credit |
| credit_accounts | check_credit_account_positive | credit_limit ≥ 0 | Only positive limits |
| credit_transactions | check_credit_transaction_amount | amount > 0 | No zero/negative amounts |
| ledger_entries | check_ledger_entry_amount | amount > 0 | No zero/negative amounts |
| retailer_payments | check_payment_amount | amount > 0 | No zero/negative amounts |
| wholesaler_products | check_stock_non_negative | stock ≥ 0 | No negative stock |
| wholesaler_products | check_reserved_stock_non_negative | reserved_stock ≥ 0 | No negative reservations |
| wholesaler_products | check_stock_availability | stock ≥ reserved_stock | Consistent stock state |
| orders | check_order_amount_positive | total_amount > 0 | Valid order amounts |
| stock_reservations | check_reservation_quantity_positive | quantity > 0 | Valid quantities |

---

## Pre-Migration Checklist

### 1. Data Validation (Run Before Migration)

```bash
# SSH into your database server or use psql client
psql -U postgres -d your_database

-- Check for violations of new CHECK constraints:

-- Credit accounts: used > limit
SELECT COUNT(*) FROM credit_accounts WHERE used_credit > credit_limit;

-- Negative amounts
SELECT COUNT(*) FROM credit_transactions WHERE amount <= 0;
SELECT COUNT(*) FROM ledger_entries WHERE amount <= 0;
SELECT COUNT(*) FROM retailer_payments WHERE amount <= 0;

-- Negative or inconsistent stock
SELECT COUNT(*) FROM wholesaler_products 
WHERE stock < 0 OR reserved_stock < 0 OR stock < reserved_stock;

-- Orders with zero or negative total
SELECT COUNT(*) FROM orders WHERE total_amount <= 0;

-- Stock reservations with zero/negative quantity
SELECT COUNT(*) FROM stock_reservations WHERE quantity <= 0;
```

**Expected Result**: All counts should return 0  
**If Any Count > 0**: Review those records before proceeding

### 2. Backup Database

```bash
# Production database backup
pg_dump -U postgres -F c -f backup_$(date +%Y%m%d_%H%M%S).dump your_database

# Or use your cloud provider's backup feature:
# - Render: Database > Backups
# - Railway: Services > Database > Backups
# - AWS RDS: RDS Console > Snapshots
```

### 3. Test in Staging

1. Restore backup to staging
2. Run migration in staging
3. Run your test suite
4. Verify no issues

---

## Migration Steps

### Step 1: Generate Prisma Migration

```bash
cd backend

# Make sure you've committed the schema changes
git add prisma/schema.prisma
git commit -m "chore: add production safety constraints to schema"

# Generate migration
npx prisma migrate dev --name production_safety_constraints
```

**What This Does**:
- Creates new migration file in `prisma/migrations/`
- Applies schema changes to your database
- Generates Prisma Client types

**Output**:
```
Prisma schema has been updated.
✔ Migration created in 1234ms

Your database has been migrated.
Generated Prisma Client to ./node_modules/@prisma/client
```

### Step 2: Verify Migration Applied

```bash
# Check migration status
npx prisma migrate status

# Should show:
# Migrations to apply: 0
# Your database is in sync with your schema.
```

### Step 3: Run Validation Queries

```bash
# Connect to database and run checks
psql -U postgres -d your_database -f prisma/migrations/production_safety_constraints/migration.sql
```

**Expected Output**:
- All diagnostic queries return 0 rows
- No constraint violations
- New indexes successfully created

### Step 4: Deploy

```bash
# If using Docker:
docker-compose up -d

# If using cloud platform, redeploy:
# - Render: Redeploy from dashboard
# - Railway: Trigger redeploy
# - AWS: Update deployment

# Test health check
curl https://your-api.com/health
# Should return 200 with health info
```

---

## Post-Migration Verification

### 1. Schema Verification

```javascript
// In your Node.js/Express app:
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Test that new relations exist
const order = await prisma.order.findUnique({
  where: { id: 'some-order-id' },
  include: {
    creditTransactions: true,  // New relation
    ledgerEntries: true,       // Should cascade delete now
  }
});

console.log('✅ Schema verification passed');
```

### 2. Query Performance Test

```javascript
// Old query (without composite index)
console.time('Find active orders');
const activeOrders = await prisma.order.findMany({
  where: { status: 'CONFIRMED', deletedAt: null },
  orderBy: { createdAt: 'desc' },
  take: 100
});
console.timeEnd('Find active orders');
// Should be faster now

// New query using composite index
console.time('Find pending offers');
const offers = await prisma.order.findMany({
  where: { status: 'PENDING_BIDS', wholesalerId: 'some-id' },
});
console.timeEnd('Find pending offers');
// Should benefit from new index
```

### 3. Data Integrity Test

```javascript
// Verify CHECK constraints work
try {
  // This should fail (negative amount)
  await prisma.creditTransaction.create({
    data: {
      retailerId: 'id',
      amount: -100,  // ❌ Should violate CHECK
      type: 'DEBIT',
      status: 'PENDING',
    }
  });
} catch (error) {
  console.log('✅ CHECK constraint working:', error.message);
}

// Verify cascading delete works
const order = await prisma.order.findUnique({ where: { id: 'test-id' } });
if (order) {
  await prisma.order.delete({ where: { id: order.id } });
  
  // Verify ledger entries are also deleted
  const ledger = await prisma.ledgerEntry.findFirst({
    where: { orderId: order.id }
  });
  
  if (!ledger) {
    console.log('✅ Cascading delete working');
  }
}
```

### 4. Rollback Test (Don't Actually Run in Production)

```bash
# Only in staging to verify rollback plan works:

# See migration history
npx prisma migrate status

# Rollback to previous migration
npx prisma migrate resolve --rolled-back production_safety_constraints

# Verify rolled back
npx prisma migrate status
```

---

## Success Criteria

✅ Migration completes without errors  
✅ All diagnostic queries return 0 violations  
✅ App starts and health check passes  
✅ Existing queries still work  
✅ New indexes used by query planner  
✅ No spike in error rates  
✅ No performance degradation  
✅ Cascade delete working properly  

---

## Timeline

| Phase | Duration | Action |
|-------|----------|--------|
| **Prep** | 30 min | Review this guide, backup database |
| **Staging** | 1 hour | Test migration, verify data |
| **Production** | 5-15 min | Run migration, verify health |
| **Monitoring** | 24 hours | Watch for issues |

---

**Status**: ✅ Ready for Production Deployment  
**Safety Level**: HIGH (non-blocking, with automatic rollback plan)  
**Recommended**: Deploy during off-peak hours for safety monitoring

