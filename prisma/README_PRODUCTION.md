# Production Schema Implementation Guide

## Overview
This production-grade Prisma schema is designed for a Nepal-scale B2B trade platform with strict data integrity, performance optimization, and audit capabilities.

## Key Features

### 1. Database Constraints
- ✅ **No negative stock**: CHECK constraint on `wholesaler_products.stock >= 0`
- ✅ **Valid reserved stock**: CHECK constraint ensuring `reserved_stock <= stock`
- ✅ **Credit limit enforcement**: CHECK constraints on credit accounts
- ✅ **One winning wholesaler**: Application logic + unique index
- ✅ **Unique WhatsApp numbers**: Unique constraints with soft delete support

### 2. Ledger Immutability
- ✅ **No updates**: Database trigger prevents UPDATE operations
- ✅ **No deletes**: Database trigger prevents DELETE operations
- ✅ **Append-only**: All changes via new CREDIT entries

### 3. Soft Delete
- ✅ **deletedAt field**: All user-facing models support soft delete
- ✅ **Indexed queries**: Partial indexes for efficient filtering
- ✅ **Audit trail**: Deleted records preserved for compliance

### 4. Performance Indexes
- ✅ **Analytics indexes**: Composite indexes for common queries
- ✅ **Lookup indexes**: Single-column indexes for foreign keys
- ✅ **Time-based indexes**: Indexes on created_at for time-series queries

### 5. Type Safety
- ✅ **Enums**: All status fields use enums
- ✅ **State machine**: OrderStatus enum with clear transitions
- ✅ **Type-safe relations**: Proper foreign key constraints

## Implementation Steps

### Step 1: Review Schema
```bash
# Review the production schema
cat backend/prisma/schema.production.prisma
```

### Step 2: Backup Current Schema
```bash
# Backup existing schema
cp backend/prisma/schema.prisma backend/prisma/schema.backup.prisma
```

### Step 3: Replace Schema
```bash
# Replace with production schema
cp backend/prisma/schema.production.prisma backend/prisma/schema.prisma
```

### Step 4: Generate Prisma Client
```bash
cd backend
npx prisma generate
```

### Step 5: Create Migration
```bash
# Create migration (review changes first)
npx prisma migrate dev --name production_schema --create-only

# Review the generated migration
# Then apply it
npx prisma migrate dev
```

### Step 6: Add Database Constraints
```bash
# Run the SQL migration for constraints
psql -h localhost -U postgres -d whatsapp_ordering -f prisma/migrations/add_production_constraints.sql
```

### Step 7: Verify Constraints
```sql
-- Connect to database
psql -h localhost -U postgres -d whatsapp_ordering

-- Verify constraints
SELECT conname, contype, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid IN (
    'wholesaler_products'::regclass,
    'credit_accounts'::regclass,
    'ledger_entries'::regclass
);
```

## Model Relationships

### Core Models
- **Retailer** ↔ **Order** (1:N)
- **Wholesaler** ↔ **Order** (1:N)
- **Order** ↔ **OrderItem** (1:N)
- **Order** ↔ **VendorOffer** (1:N)
- **Wholesaler** ↔ **WholesalerProduct** (1:N)
- **WholesalerProduct** ↔ **StockReservation** (1:N)

### Credit Models
- **Retailer** ↔ **CreditAccount** (1:1)
- **Retailer** ↔ **RetailerWholesalerCredit** (1:N)
- **Retailer** ↔ **LedgerEntry** (1:N)
- **LedgerEntry** ↔ **RetailerPayment** (1:1)

### Audit Models
- **Admin** ↔ **AdminAuditLog** (1:N)
- **Retailer** ↔ **AuditLog** (1:N)
- **Order** ↔ **DecisionConflictLog** (1:N)

## Important Notes

### 1. Ledger Immutability
The ledger is **append-only**. To reverse a transaction:
- Create a new CREDIT entry (not UPDATE the DEBIT)
- Never DELETE ledger entries
- Database triggers will prevent accidental modifications

### 2. Soft Delete
Always filter by `deletedAt IS NULL` in queries:
```typescript
const retailers = await prisma.retailer.findMany({
  where: { deletedAt: null }
});
```

### 3. Stock Management
- Stock is validated at database level (CHECK constraint)
- Reserved stock cannot exceed total stock
- Use transactions for stock operations

### 4. Credit Limits
- Enforced at database level (CHECK constraint)
- Application should also validate before creating orders
- Ledger entries track actual usage

### 5. One Winning Wholesaler
- Enforced via application logic in decision engine
- `final_wholesaler_id` is set atomically in transaction
- Conflict logging tracks any attempts

## Performance Considerations

### Index Usage
- All foreign keys are indexed
- Composite indexes for common query patterns
- Partial indexes for soft delete filtering

### Query Optimization
- Use `select` to limit fields
- Use `where` with indexed columns
- Use pagination for large result sets

### Scale Considerations
For Nepal-scale (10M+ records):
- Consider read replicas
- Partition large tables (ledger_entries, orders)
- Archive old data (>2 years)

## Testing

### Unit Tests
Test all constraints:
```typescript
// Test negative stock prevention
await expect(
  prisma.wholesalerProduct.update({
    where: { id },
    data: { stock: -1 }
  })
).rejects.toThrow();

// Test ledger immutability
await expect(
  prisma.ledgerEntry.update({
    where: { id },
    data: { amount: 100 }
  })
).rejects.toThrow();
```

### Integration Tests
- Test order flow end-to-end
- Test credit limit enforcement
- Test stock reservation
- Test conflict detection

## Monitoring

### Key Metrics
1. **Constraint violations**: Monitor error logs
2. **Query performance**: Monitor slow queries
3. **Index usage**: Monitor index hit rates
4. **Soft delete growth**: Monitor deleted record counts

### Alerts
- Alert on CHECK constraint violations
- Alert on ledger modification attempts
- Alert on slow queries (>1s)
- Alert on index bloat

## Rollback Plan

If issues occur:
1. Restore from backup
2. Revert Prisma migration: `npx prisma migrate resolve --rolled-back <migration_name>`
3. Remove constraints: See `MIGRATION_STRATEGY.md`

## Support

For questions or issues:
1. Review `MIGRATION_STRATEGY.md` for detailed migration steps
2. Check constraint definitions in `add_production_constraints.sql`
3. Review Prisma migration files in `prisma/migrations/`
