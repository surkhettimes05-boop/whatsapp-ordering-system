/*
  Warnings:

  - You are about to drop the `CreditLedgerEntry` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('DEBIT', 'CREDIT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LedgerEntryCreator" AS ENUM ('SYSTEM', 'ADMIN');

-- DropForeignKey
ALTER TABLE "CreditLedgerEntry" DROP CONSTRAINT "CreditLedgerEntry_retailerId_fkey";

-- DropForeignKey
ALTER TABLE "CreditLedgerEntry" DROP CONSTRAINT "CreditLedgerEntry_wholesalerId_fkey";

-- DropForeignKey
ALTER TABLE "RetailerPayment" DROP CONSTRAINT "RetailerPayment_ledgerEntryId_fkey";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "final_wholesaler_id" TEXT;

-- DropTable
DROP TABLE "CreditLedgerEntry";

-- CreateTable
CREATE TABLE "VendorOffer" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "wholesaler_id" TEXT NOT NULL,
    "price_quote" DOUBLE PRECISION NOT NULL,
    "delivery_eta" TEXT NOT NULL,
    "stock_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "VendorOffer_order_id_wholesaler_id_key" ON "VendorOffer"("order_id", "wholesaler_id");

-- CreateIndex
CREATE INDEX "LedgerEntry_retailerId_wholesalerId_idx" ON "LedgerEntry"("retailerId", "wholesalerId");

-- CreateIndex
CREATE INDEX "LedgerEntry_orderId_idx" ON "LedgerEntry"("orderId");

-- CreateIndex
CREATE INDEX "LedgerEntry_createdAt_idx" ON "LedgerEntry"("createdAt");

-- AddForeignKey
ALTER TABLE "VendorOffer" ADD CONSTRAINT "VendorOffer_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorOffer" ADD CONSTRAINT "VendorOffer_wholesaler_id_fkey" FOREIGN KEY ("wholesaler_id") REFERENCES "Wholesaler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_wholesalerId_fkey" FOREIGN KEY ("wholesalerId") REFERENCES "Wholesaler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerPayment" ADD CONSTRAINT "RetailerPayment_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
