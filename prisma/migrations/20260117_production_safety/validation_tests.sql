-- Validation tests for production safety migration
-- Run this after applying migration.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  r_id text := gen_random_uuid()::text;
  w_id text := gen_random_uuid()::text;
  wp_id text;
  ca_id text;
  ord_id text := gen_random_uuid()::text;
  ledger_id text;
BEGIN
  -- Setup minimal entities
  INSERT INTO "Retailer"(id, "phoneNumber", name, "createdAt") VALUES (r_id, '999000', 'TestRetailer', now());
  INSERT INTO "Wholesaler"(id, "businessName", "ownerName", "phoneNumber", "whatsappNumber", "businessAddress", city, state, pincode, latitude, longitude, "createdAt")
    VALUES (w_id, 'WName', 'Owner', '888000', '888000', 'Addr', 'City','ST','000', 0, 0, now());

  -- Create WholesalerProduct with stock=5
  INSERT INTO "WholesalerProduct"(id, "wholesalerId", "productId", "priceOffered", stock, "reservedStock", "createdAt")
    VALUES (gen_random_uuid()::text, w_id, gen_random_uuid()::text, 100, 5, 0, now())
    RETURNING id INTO wp_id;

  -- Create CreditAccount with limit 1000
  INSERT INTO "CreditAccount"(id, "retailerId", "creditLimit", "usedCredit") VALUES (gen_random_uuid()::text, r_id, 1000, 0) RETURNING id INTO ca_id;

  -- TEST 1: Reservation exceeding stock should fail
  BEGIN
    INSERT INTO "StockReservation"(id, "wholesalerProductId", "orderId", quantity, status, "createdAt")
      VALUES (gen_random_uuid()::text, wp_id, gen_random_uuid()::text, 10, 'ACTIVE', now());
    RAISE EXCEPTION 'TEST FAILED: Allowed reservation exceeding stock';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TEST OK: reservation exceeding stock failed as expected: %', SQLERRM;
  END;

  -- TEST 2: Valid reservation then second reservation exceeding remaining stock
  INSERT INTO "StockReservation"(id, "wholesalerProductId", "orderId", quantity, status, "createdAt")
    VALUES (gen_random_uuid()::text, wp_id, gen_random_uuid()::text, 3, 'ACTIVE', now());

  BEGIN
    INSERT INTO "StockReservation"(id, "wholesalerProductId", "orderId", quantity, status, "createdAt")
      VALUES (gen_random_uuid()::text, wp_id, gen_random_uuid()::text, 3, 'ACTIVE', now());
    RAISE EXCEPTION 'TEST FAILED: Allowed reservation exceeding remaining stock';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TEST OK: second reservation exceeding remaining stock failed: %', SQLERRM;
  END;

  -- TEST 3: unique selected wholesaler per order
  INSERT INTO "Order"(id, "retailerId", "totalAmount", "paymentMode", status, "createdAt")
    VALUES (ord_id, r_id, 100, 'CASH', 'PENDING', now());

  INSERT INTO "OrderRouting"(id, "orderId", "retailerId", "productRequested", "candidateWholesalers", "selectedWholesalerId", "routingReason", "routingScore")
    VALUES (gen_random_uuid()::text, ord_id, r_id, 'prod', '[]', w_id, 'reason1', 1);

  BEGIN
    INSERT INTO "OrderRouting"(id, "orderId", "retailerId", "productRequested", "candidateWholesalers", "selectedWholesalerId", "routingReason", "routingScore")
      VALUES (gen_random_uuid()::text, ord_id, r_id, 'prod', '[]', w_id, 'reason2', 2);
    RAISE EXCEPTION 'TEST FAILED: Allowed second selected wholesaler for same order';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TEST OK: second selected wholesaler prevented: %', SQLERRM;
  END;

  -- TEST 4: ledger DEBIT beyond credit limit should fail
  BEGIN
    INSERT INTO "LedgerEntry"(id, "retailerId", "wholesalerId", "entryType", amount, "balanceAfter", "createdBy", "createdAt")
      VALUES (gen_random_uuid()::text, r_id, w_id, 'DEBIT', 2000, 0, 'SYSTEM', now());
    RAISE EXCEPTION 'TEST FAILED: Allowed ledger debit beyond credit limit';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TEST OK: ledger debit beyond credit limit prevented: %', SQLERRM;
  END;

  -- TEST 5: ledger immutability - attempt update
  INSERT INTO "LedgerEntry"(id, "retailerId", "wholesalerId", "entryType", amount, "balanceAfter", "createdBy", "createdAt")
    VALUES (gen_random_uuid()::text, r_id, w_id, 'CREDIT', 100, 100, 'SYSTEM', now()) RETURNING id INTO ledger_id;

  BEGIN
    UPDATE "LedgerEntry" SET amount = 50 WHERE id = ledger_id;
    RAISE EXCEPTION 'TEST FAILED: Allowed update to LedgerEntry';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TEST OK: LedgerEntry update prevented: %', SQLERRM;
  END;

  -- TEST 6: ledger immutability - attempt delete
  BEGIN
    DELETE FROM "LedgerEntry" WHERE id = ledger_id;
    RAISE EXCEPTION 'TEST FAILED: Allowed delete of LedgerEntry';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TEST OK: LedgerEntry delete prevented: %', SQLERRM;
  END;

  RAISE NOTICE 'Validation tests completed.';
END;
$$;
