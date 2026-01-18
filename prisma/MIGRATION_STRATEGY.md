# Production Migration Strategy
## Nepal-Scale B2B Trade Platform

### Overview
This document outlines the migration strategy for implementing database-level constraints, indexes, and ensuring data integrity for a production-grade system.

---

## 1. Database Constraints (PostgreSQL CHECK Constraints)

### Stock Constraint: No Negative Stock
```sql
-- Migration: Add CHECK constraint to prevent negative stock
ALTER TABLE wholesaler_products 
ADD CONSTRAINT check_stock_non_negative 
CHECK (stock >= 0);

-- Also ensure reserved stock doesn't exceed total stock
ALTER TABLE wholesaler_products 
ADD CONSTRAINT check_reserved_stock_valid 
CHECK (reserved_stock <= stock);
```

### Credit Limit Enforcement
```sql
-- Migration: Add CHECK constraint for credit limits
ALTER TABLE credit_accounts 
ADD CONSTRAINT check_credit_limit_positive 
CHECK (credit_limit >= 0);

ALTER TABLE credit_accounts 
ADD CONSTRAINT check_used_credit_valid 
CHECK (used_credit >= 0 AND used_credit <= credit_limit);

-- Per-wholesaler credit limit
ALTER TABLE retailer_wholesaler_credits 
ADD CONSTRAINT check_wholesaler_credit_limit_positive 
CHECK (credit_limit >= 0);
```

### One Winning Wholesaler Per Order
```sql
-- Migration: Add partial unique index to enforce one winning wholesaler
-- This is already handled via application logic, but we can add a partial unique index
CREATE UNIQUE INDEX idx_order_final_wholesaler_unique 
ON orders(id) 
WHERE final_wholesaler_id IS NOT NULL;
```

### Unique WhatsApp Number
```sql
-- Already enforced via Prisma @unique constraint
-- Additional index for performance:
CREATE UNIQUE INDEX idx_retailers_whatsapp_unique ON retailers(whatsapp_number) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_wholesalers_whatsapp_unique ON wholesalers(whatsapp_number) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_users_whatsapp_unique ON users(whatsapp_number) WHERE deleted_at IS NULL;
```

---

## 2. Ledger Immutability

### Approach: Application-Level Enforcement + Database Triggers

#### Application-Level (Recommended)
- **No UPDATE operations** on LedgerEntry model
- **No DELETE operations** on LedgerEntry model
- Use Prisma middleware to prevent updates/deletes
- All changes via new CREDIT entries to reverse DEBIT entries

#### Database-Level (Additional Safety)
```sql
-- Migration: Prevent updates/deletes on ledger entries
CREATE OR REPLACE FUNCTION prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Ledger entries are immutable. Use new entries to reverse transactions.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_ledger_update
BEFORE UPDATE ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION prevent_ledger_modification();

CREATE TRIGGER prevent_ledger_delete
BEFORE DELETE ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION prevent_ledger_modification();
```

---

## 3. Indexes for Performance

### Critical Indexes (Already in Schema)
All critical indexes are defined in the Prisma schema using `@@index` directives.

### Additional Composite Indexes for Analytics
```sql
-- Order analytics
CREATE INDEX idx_orders_retailer_status_created ON orders(retailer_id, status, created_at DESC);
CREATE INDEX idx_orders_wholesaler_status_created ON orders(wholesaler_id, status, created_at DESC);

-- Offer analytics
CREATE INDEX idx_vendor_offers_wholesaler_status_created ON vendor_offers(wholesaler_id, status, created_at DESC);
CREATE INDEX idx_vendor_offers_order_status ON vendor_offers(order_id, status);

-- Ledger analytics
CREATE INDEX idx_ledger_entries_retailer_wholesaler_type_created 
ON ledger_entries(retailer_id, wholesaler_id, entry_type, created_at DESC);

-- Stock analytics
CREATE INDEX idx_stock_reservations_status_created ON stock_reservations(status, created_at DESC);
```

---

## 4. Soft Delete Implementation

### Query Filtering
```typescript
// Prisma middleware to filter soft-deleted records
prisma.$use(async (params, next) => {
  if (params.model && ['Retailer', 'Wholesaler', 'User', 'Product'].includes(params.model)) {
    if (params.action === 'findMany' || params.action === 'findFirst') {
      params.args.where = {
        ...params.args.where,
        deletedAt: null
      };
    }
  }
  return next(params);
});
```

### Hard Delete for Admins
```typescript
// Admin-only hard delete function
async function hardDeleteRetailer(id: string) {
  return prisma.retailer.delete({
    where: { id }
  });
}
```

---

## 5. Migration Steps

### Step 1: Backup Existing Data
```bash
pg_dump -h localhost -U postgres -d whatsapp_ordering > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Create Migration
```bash
npx prisma migrate dev --name production_schema_constraints
```

### Step 3: Add Custom Constraints (Manual SQL)
```bash
# Run the SQL constraints from section 1 above
psql -h localhost -U postgres -d whatsapp_ordering -f constraints.sql
```

### Step 4: Verify Constraints
```sql
-- Check constraints
SELECT conname, contype, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'wholesaler_products'::regclass;

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'orders';
```

### Step 5: Data Migration (if needed)
```sql
-- Ensure no negative stock exists
UPDATE wholesaler_products SET stock = 0 WHERE stock < 0;
UPDATE wholesaler_products SET reserved_stock = stock WHERE reserved_stock > stock;

-- Ensure no invalid credit limits
UPDATE credit_accounts SET used_credit = credit_limit WHERE used_credit > credit_limit;
```

---

## 6. Performance Considerations

### Partitioning (Future)
For Nepal-scale (millions of records), consider partitioning:
- `ledger_entries` by `created_at` (monthly partitions)
- `orders` by `created_at` (monthly partitions)
- `webhook_logs` by `created_at` (weekly partitions)

### Archival Strategy
```sql
-- Archive old ledger entries (read-only)
CREATE TABLE ledger_entries_archive (LIKE ledger_entries INCLUDING ALL);

-- Move entries older than 2 years
INSERT INTO ledger_entries_archive 
SELECT * FROM ledger_entries 
WHERE created_at < NOW() - INTERVAL '2 years';
```

---

## 7. Monitoring & Alerts

### Key Metrics to Monitor
1. **Stock violations**: Alert if CHECK constraint fails
2. **Credit limit violations**: Alert if CHECK constraint fails
3. **Ledger modification attempts**: Log all UPDATE/DELETE attempts
4. **Index usage**: Monitor slow queries
5. **Soft delete growth**: Monitor `deleted_at IS NOT NULL` counts

### Query Performance
```sql
-- Monitor slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;
```

---

## 8. Rollback Strategy

### If Migration Fails
1. **Restore from backup**
2. **Remove constraints**:
   ```sql
   ALTER TABLE wholesaler_products DROP CONSTRAINT IF EXISTS check_stock_non_negative;
   ALTER TABLE credit_accounts DROP CONSTRAINT IF EXISTS check_credit_limit_positive;
   ```
3. **Drop triggers**:
   ```sql
   DROP TRIGGER IF EXISTS prevent_ledger_update ON ledger_entries;
   DROP TRIGGER IF EXISTS prevent_ledger_delete ON ledger_entries;
   ```

---

## 9. Testing Checklist

- [ ] Stock constraint prevents negative values
- [ ] Reserved stock cannot exceed total stock
- [ ] Credit limits are enforced
- [ ] Ledger entries cannot be updated/deleted
- [ ] Unique WhatsApp numbers enforced
- [ ] One winning wholesaler per order
- [ ] Soft delete filters work correctly
- [ ] All indexes are created
- [ ] Query performance is acceptable
- [ ] Backup/restore process works

---

## 10. Production Deployment

### Pre-Deployment
1. Run migrations on staging
2. Load test with production-like data
3. Verify all constraints
4. Test rollback procedure

### Deployment
1. **Maintenance window** (if needed for large migrations)
2. **Backup database**
3. **Run migrations**
4. **Verify constraints**
5. **Monitor for 24 hours**

### Post-Deployment
1. Monitor error rates
2. Check constraint violations
3. Review query performance
4. Verify soft delete behavior

---

## Notes

- **Prisma Limitations**: Some constraints (like CHECK) must be added via raw SQL migrations
- **Application Logic**: Some constraints (like ledger immutability) are best enforced in application code
- **Performance**: Indexes may slow down writes; monitor and adjust
- **Scale**: For Nepal-scale (10M+ records), consider read replicas and partitioning
