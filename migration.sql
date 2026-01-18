-- Migration Script to Initialize Ledger System

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "LedgerEntryType" AS ENUM ('DEBIT', 'CREDIT', 'ADJUSTMENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "LedgerEntryCreator" AS ENUM ('SYSTEM', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Drop Old Table if exists
DROP TABLE IF EXISTS "CreditLedgerEntry" CASCADE;

-- Create LedgerEntry Table
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "wholesalerId" TEXT NOT NULL,
    "orderId" TEXT,
    "entryType" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "balanceAfter" DECIMAL(65,30) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "createdBy" "LedgerEntryCreator" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- Add Foreign Keys
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_wholesalerId_fkey" FOREIGN KEY ("wholesalerId") REFERENCES "Wholesaler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Update RetailerPayment Foreign Key
-- Note: You may need to drop existing constraint if name differs. 
-- Checking standard naming: RetailerPayment_ledgerEntryId_fkey
ALTER TABLE "RetailerPayment" DROP CONSTRAINT IF EXISTS "RetailerPayment_ledgerEntryId_fkey";
ALTER TABLE "RetailerPayment" ADD CONSTRAINT "RetailerPayment_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create Indexes
CREATE INDEX "LedgerEntry_retailerId_wholesalerId_idx" ON "LedgerEntry"("retailerId", "wholesalerId");
CREATE INDEX "LedgerEntry_orderId_idx" ON "LedgerEntry"("orderId");
CREATE INDEX "LedgerEntry_createdAt_idx" ON "LedgerEntry"("createdAt");
