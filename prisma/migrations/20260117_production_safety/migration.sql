-- Production safety migration: enforce non-negative stock, single selected vendor, credit limits, immutable ledger
BEGIN;

-- 1) Ensure WholesalerProduct stock constraints
ALTER TABLE "WholesalerProduct"
  ADD CONSTRAINT chk_wholesalerproduct_stock_nonnegative CHECK (stock >= 0 AND "reservedStock" >= 0 AND "reservedStock" <= stock);

-- 2) Maintain reservedStock via trigger on StockReservation
CREATE OR REPLACE FUNCTION adjust_reserved_stock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  delta int;
BEGIN
    IF TG_OP = 'INSERT' THEN
    IF NEW.quantity <= 0 THEN
      RAISE EXCEPTION 'StockReservation.quantity must be positive';
    END IF;
    UPDATE "WholesalerProduct" wp
      SET "reservedStock" = wp."reservedStock" + NEW.quantity
      WHERE wp.id = NEW."wholesalerProductId";
    PERFORM 1 FROM "WholesalerProduct" wp2 WHERE wp2.id = NEW."wholesalerProductId" AND wp2."reservedStock" <= wp2.stock;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient stock for product %', NEW."wholesalerProductId";
    END IF;
    RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.quantity <= 0 THEN
      RAISE EXCEPTION 'StockReservation.quantity must be positive';
    END IF;
    delta := NEW.quantity - OLD.quantity;
    UPDATE "WholesalerProduct" wp
      SET "reservedStock" = wp."reservedStock" + delta
      WHERE wp.id = NEW."wholesalerProductId";
    PERFORM 1 FROM "WholesalerProduct" wp2 WHERE wp2.id = NEW."wholesalerProductId" AND wp2."reservedStock" <= wp2.stock;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient stock for product % after update', NEW."wholesalerProductId";
    END IF;
    RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
    UPDATE "WholesalerProduct" wp
      SET "reservedStock" = GREATEST(0, wp."reservedStock" - OLD.quantity)
      WHERE wp.id = OLD."wholesalerProductId";
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_adjust_reserved_stock
  AFTER INSERT OR UPDATE OR DELETE ON "StockReservation"
  FOR EACH ROW EXECUTE PROCEDURE adjust_reserved_stock();

-- 3) Prevent multiple selected wholesaler assignments per order (partial unique index)
-- This enforces at most one OrderRouting row with selectedWholesalerId per order
CREATE UNIQUE INDEX IF NOT EXISTS unique_selected_wholesaler_per_order
  ON "OrderRouting" ("orderId")
  WHERE "selectedWholesalerId" IS NOT NULL;

-- 4) Enforce credit limits and update CreditAccount.usedCredit atomically when ledger entries are inserted
CREATE OR REPLACE FUNCTION enforce_credit_on_ledger_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  ca RECORD;
  new_used numeric;
BEGIN
  -- Only act for DEBIT/CREDIT entries; ADJUSTMENT/REVERSAL should be handled carefully by admin flows
  IF NEW."entryType" = 'DEBIT' THEN
    SELECT * INTO ca FROM "CreditAccount" WHERE "retailerId" = NEW."retailerId" FOR UPDATE;
    IF FOUND THEN
      new_used := ca."usedCredit" + NEW.amount;
      IF new_used > ca."creditLimit" THEN
        RAISE EXCEPTION 'Credit limit exceeded for retailer %: limit=% used=% would_be=%', NEW."retailerId", ca."creditLimit", ca."usedCredit", new_used;
      END IF;
      UPDATE "CreditAccount" SET "usedCredit" = new_used WHERE id = ca.id;
    ELSE
      -- if no credit account exists, disallow debit ledger entries
      RAISE EXCEPTION 'No credit account for retailer %, cannot apply debit ledger entry', NEW."retailerId";
    END IF;
  ELSIF NEW."entryType" = 'CREDIT' THEN
    SELECT * INTO ca FROM "CreditAccount" WHERE "retailerId" = NEW."retailerId" FOR UPDATE;
    IF FOUND THEN
      new_used := ca."usedCredit" - NEW.amount;
      IF new_used < 0 THEN
        new_used := 0; -- prevent negative used credit
      END IF;
      UPDATE "CreditAccount" SET "usedCredit" = new_used WHERE id = ca.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Use BEFORE INSERT so the ledger insert and credit update can be done in single transaction
CREATE TRIGGER trg_enforce_credit_on_ledger_insert
  BEFORE INSERT ON "LedgerEntry"
  FOR EACH ROW EXECUTE PROCEDURE enforce_credit_on_ledger_insert();

-- 5) Make ledger immutable: disallow UPDATE or DELETE
CREATE OR REPLACE FUNCTION prevent_ledger_modifications() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'LedgerEntry is immutable; updates/deletes are not allowed';
END;
$$;

CREATE TRIGGER trg_prevent_ledger_update
  BEFORE UPDATE OR DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE PROCEDURE prevent_ledger_modifications();

-- 6) CreditAccount constraints
ALTER TABLE "CreditAccount"
  ADD CONSTRAINT chk_creditaccount_nonnegative CHECK ("creditLimit" >= 0 AND "usedCredit" >= 0);

-- 7) RetailerWholesalerCredit sanity
ALTER TABLE "RetailerWholesalerCredit"
  ADD CONSTRAINT chk_retailerwholesaler_credit_nonnegative CHECK ("creditLimit" >= 0);

-- 8) OrderItem quantity constraint
ALTER TABLE "OrderItem"
  ADD CONSTRAINT chk_orderitem_quantity_positive CHECK (quantity > 0);

COMMIT;

-- Notes:
-- 1) These triggers use FOR UPDATE and will run inside the same transaction as the INSERT into LedgerEntry or StockReservation.
-- 2) Application-level operations must perform writes inside a single DB transaction; triggers ensure invariants at the DB level and will abort the transaction if violated.
-- 3) To remove ledger immutability for exceptional admin reversals, create separate administrative reversal entries (type REVERSAL) instead of updating/deleting rows.
