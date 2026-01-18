-- ============================================================================
-- PRODUCTION CONSTRAINTS MIGRATION
-- Nepal-Scale B2B Trade Platform
-- ============================================================================
-- 
-- This migration adds database-level constraints that cannot be expressed
-- directly in Prisma schema:
-- 1. Stock non-negative constraint
-- 2. Credit limit enforcement
-- 3. Ledger immutability triggers
-- 4. Additional performance indexes
--
-- Run this AFTER running Prisma migrations
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. STOCK CONSTRAINTS
-- ============================================================================

-- Prevent negative stock
ALTER TABLE wholesaler_products 
ADD CONSTRAINT check_stock_non_negative 
CHECK (stock >= 0);

-- Ensure reserved stock doesn't exceed total stock
ALTER TABLE wholesaler_products 
ADD CONSTRAINT check_reserved_stock_valid 
CHECK (reserved_stock >= 0 AND reserved_stock <= stock);

-- ============================================================================
-- 2. CREDIT LIMIT CONSTRAINTS
-- ============================================================================

-- Credit account constraints
ALTER TABLE credit_accounts 
ADD CONSTRAINT check_credit_limit_positive 
CHECK (credit_limit >= 0);

ALTER TABLE credit_accounts 
ADD CONSTRAINT check_used_credit_valid 
CHECK (used_credit >= 0 AND used_credit <= credit_limit);

ALTER TABLE credit_accounts 
ADD CONSTRAINT check_max_order_value_positive 
CHECK (max_order_value >= 0);

-- Per-wholesaler credit constraints
ALTER TABLE retailer_wholesaler_credits 
ADD CONSTRAINT check_wholesaler_credit_limit_positive 
CHECK (credit_limit >= 0);

ALTER TABLE retailer_wholesaler_credits 
ADD CONSTRAINT check_credit_terms_positive 
CHECK (credit_terms > 0);

-- ============================================================================
-- 3. ORDER CONSTRAINTS
-- ============================================================================

-- Ensure order amount is positive
ALTER TABLE orders 
ADD CONSTRAINT check_order_amount_positive 
CHECK (total_amount >= 0);

-- Ensure expiry is in the future (if set)
-- Note: This is checked at application level, but can add trigger if needed

-- ============================================================================
-- 4. LEDGER IMMUTABILITY TRIGGERS
-- ============================================================================

-- Function to prevent ledger updates
CREATE OR REPLACE FUNCTION prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Ledger entries are immutable. Use new CREDIT entries to reverse DEBIT entries. Entry ID: %', OLD.id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent updates
DROP TRIGGER IF EXISTS prevent_ledger_update ON ledger_entries;
CREATE TRIGGER prevent_ledger_update
BEFORE UPDATE ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION prevent_ledger_modification();

-- Trigger to prevent deletes
DROP TRIGGER IF EXISTS prevent_ledger_delete ON ledger_entries;
CREATE TRIGGER prevent_ledger_delete
BEFORE DELETE ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION prevent_ledger_modification();

-- ============================================================================
-- 5. ADDITIONAL PERFORMANCE INDEXES
-- ============================================================================

-- Order analytics indexes
CREATE INDEX IF NOT EXISTS idx_orders_retailer_status_created 
ON orders(retailer_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_wholesaler_status_created 
ON orders(wholesaler_id, status, created_at DESC) 
WHERE wholesaler_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_final_wholesaler_status 
ON orders(final_wholesaler_id, status) 
WHERE final_wholesaler_id IS NOT NULL;

-- Offer analytics indexes
CREATE INDEX IF NOT EXISTS idx_vendor_offers_wholesaler_status_created 
ON vendor_offers(wholesaler_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_offers_order_status_created 
ON vendor_offers(order_id, status, created_at DESC);

-- Ledger analytics indexes
CREATE INDEX IF NOT EXISTS idx_ledger_entries_retailer_wholesaler_type_created 
ON ledger_entries(retailer_id, wholesaler_id, entry_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_due_date 
ON ledger_entries(due_date) 
WHERE due_date IS NOT NULL AND entry_type = 'DEBIT';

-- Stock reservation indexes
CREATE INDEX IF NOT EXISTS idx_stock_reservations_status_created 
ON stock_reservations(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_order_status 
ON stock_reservations(order_id, status);

-- Webhook log indexes
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status_next_retry 
ON webhook_logs(status, next_retry_at) 
WHERE status IN ('PENDING', 'RETRYING');

-- Admin audit log indexes
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_action_created 
ON admin_audit_logs(admin_id, action, created_at DESC);

-- Soft delete indexes (for efficient filtering)
CREATE INDEX IF NOT EXISTS idx_retailers_deleted_at 
ON retailers(deleted_at) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_wholesalers_deleted_at 
ON wholesalers(deleted_at) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_deleted_at 
ON users(deleted_at) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_deleted_at 
ON products(deleted_at) 
WHERE deleted_at IS NULL;

-- ============================================================================
-- 6. UNIQUE CONSTRAINTS WITH SOFT DELETE SUPPORT
-- ============================================================================

-- Partial unique indexes for WhatsApp numbers (excluding soft-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS idx_retailers_whatsapp_active 
ON retailers(whatsapp_number) 
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wholesalers_whatsapp_active 
ON wholesalers(whatsapp_number) 
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_whatsapp_active 
ON users(whatsapp_number) 
WHERE deleted_at IS NULL;

-- ============================================================================
-- 7. ONE WINNING WHOLESALER PER ORDER
-- ============================================================================

-- Partial unique index to ensure one final wholesaler per order
-- Note: This is enforced at application level, but index helps with queries
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_final_wholesaler_unique 
ON orders(id) 
WHERE final_wholesaler_id IS NOT NULL;

-- ============================================================================
-- 8. DATA VALIDATION FUNCTIONS (Optional - for additional safety)
-- ============================================================================

-- Function to validate stock before reservation
CREATE OR REPLACE FUNCTION validate_stock_reservation()
RETURNS TRIGGER AS $$
DECLARE
    available_stock INT;
BEGIN
    SELECT (stock - COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN quantity ELSE 0 END), 0))
    INTO available_stock
    FROM wholesaler_products wp
    LEFT JOIN stock_reservations sr ON sr.wholesaler_product_id = wp.id
    WHERE wp.id = NEW.wholesaler_product_id
    GROUP BY wp.id, wp.stock;
    
    IF available_stock < NEW.quantity THEN
        RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', available_stock, NEW.quantity;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for stock reservation validation
DROP TRIGGER IF EXISTS validate_stock_before_reservation ON stock_reservations;
CREATE TRIGGER validate_stock_before_reservation
BEFORE INSERT ON stock_reservations
FOR EACH ROW
WHEN (NEW.status = 'ACTIVE')
EXECUTE FUNCTION validate_stock_reservation();

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify constraints
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid IN (
    'wholesaler_products'::regclass,
    'credit_accounts'::regclass,
    'retailer_wholesaler_credits'::regclass,
    'orders'::regclass
)
ORDER BY conrelid::regclass::text, conname;

-- Verify triggers
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND event_object_table IN ('ledger_entries', 'stock_reservations')
ORDER BY event_object_table, trigger_name;

-- Verify indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
