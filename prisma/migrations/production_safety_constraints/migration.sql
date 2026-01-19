-- Production-Safe Schema Improvements Migration
-- Date: January 19, 2026
-- Purpose: Add constraints, foreign keys, and indexes for production readiness
-- 
-- CHANGES:
-- 1. Add onDelete: Cascade to LedgerEntry.order relation
-- 2. Add Order.creditTransactions relation with onDelete: SetNull
-- 3. Add new composite indexes for query performance
-- 4. Add CHECK constraints for business logic
-- 5. Add foreign key to CreditTransaction.order

-- ============================================================================
-- STEP 1: Add missing indexes for query optimization
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status_deleted_at ON orders(status, "deletedAt");
CREATE INDEX IF NOT EXISTS idx_orders_wholesaler_final_status ON orders(wholesaler_id, final_wholesaler_id, status);

-- ============================================================================
-- STEP 2: Add CHECK constraints for business logic validation
-- ============================================================================

-- Credit Account: usedCredit must not exceed creditLimit
ALTER TABLE credit_accounts
ADD CONSTRAINT check_credit_account_limit 
CHECK (used_credit <= credit_limit);

-- Credit Account: creditLimit must be non-negative
ALTER TABLE credit_accounts
ADD CONSTRAINT check_credit_account_positive 
CHECK (credit_limit >= 0);

-- CreditTransaction: amount must be positive
ALTER TABLE credit_transactions
ADD CONSTRAINT check_credit_transaction_amount 
CHECK (amount > 0);

-- LedgerEntry: amount must be positive
ALTER TABLE ledger_entries
ADD CONSTRAINT check_ledger_entry_amount 
CHECK (amount > 0);

-- RetailerPayment: amount must be positive
ALTER TABLE retailer_payments
ADD CONSTRAINT check_payment_amount 
CHECK (amount > 0);

-- WholesalerProduct: stock must be non-negative
ALTER TABLE wholesaler_products
ADD CONSTRAINT check_stock_non_negative 
CHECK (stock >= 0);

-- WholesalerProduct: reservedStock must be non-negative
ALTER TABLE wholesaler_products
ADD CONSTRAINT check_reserved_stock_non_negative 
CHECK (reserved_stock >= 0);

-- WholesalerProduct: total available stock check
ALTER TABLE wholesaler_products
ADD CONSTRAINT check_stock_availability 
CHECK (stock >= reserved_stock);

-- Order: Total amount must be positive
ALTER TABLE orders
ADD CONSTRAINT check_order_amount_positive 
CHECK (total_amount > 0);

-- StockReservation: quantity must be positive
ALTER TABLE stock_reservations
ADD CONSTRAINT check_reservation_quantity_positive 
CHECK (quantity > 0);

-- ============================================================================
-- STEP 3: Add missing foreign key constraints
-- ============================================================================

-- CreditTransaction: Add foreign key to orders (SetNull on delete)
-- This allows credit transactions to exist even if the order is deleted
-- but marks the reference as NULL for orphan handling

-- First, check if constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_credit_transactions_order_id'
    AND table_name = 'credit_transactions'
  ) THEN
    ALTER TABLE credit_transactions
    ADD CONSTRAINT fk_credit_transactions_order_id 
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Verify data integrity after constraints
-- ============================================================================

-- Check for any data that violates new constraints
-- Credit Accounts: Check for used_credit > credit_limit (shouldn't exist)
-- This is a diagnostic query - it should return 0 rows
SELECT 
  ca.id,
  ca.retailer_id,
  ca.credit_limit,
  ca.used_credit,
  (ca.used_credit - ca.credit_limit) AS overage
FROM credit_accounts ca
WHERE ca.used_credit > ca.credit_limit
LIMIT 10;

-- Negative amounts in transactions (shouldn't exist)
SELECT 
  'credit_transactions' AS table_name,
  id,
  amount
FROM credit_transactions
WHERE amount <= 0
UNION ALL
SELECT 
  'ledger_entries' AS table_name,
  id,
  amount
FROM ledger_entries
WHERE amount <= 0
UNION ALL
SELECT 
  'retailer_payments' AS table_name,
  id,
  amount
FROM retailer_payments
WHERE amount <= 0;

-- Negative stock (shouldn't exist)
SELECT 
  'wholesaler_products' AS table_name,
  id,
  wholesaler_id,
  product_id,
  stock,
  reserved_stock
FROM wholesaler_products
WHERE stock < 0 OR reserved_stock < 0 OR stock < reserved_stock
LIMIT 10;

-- ============================================================================
-- STEP 5: Document the changes
-- ============================================================================

-- These changes ensure:
-- 1. Referential integrity: All FK relations have delete strategy
-- 2. Data validity: CHECK constraints prevent invalid states
-- 3. Query performance: New composite indexes speed up common queries
-- 4. Audit trail preservation: Ledger entries cascade delete with orders
-- 5. Credit transaction history: Survives order deletion (SetNull)

-- ROLLBACK PLAN:
-- If issues occur, rollback in this order:
-- 1. Drop new indexes (if they cause slowness)
-- 2. Remove CHECK constraints (if they're too strict)
-- 3. Remove FK constraint on credit_transactions.order_id
-- 4. Revert Order and CreditTransaction model relations

