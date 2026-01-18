/*
  Warnings:

  - You are about to drop the `AdminAuditLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AuditLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Conversation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ConversationMessage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CreditAccount` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CreditHoldHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CreditTransaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LedgerEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Order` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrderItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrderRouting` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PendingOrder` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Retailer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RetailerInsight` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RetailerPayment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RetailerWholesalerCredit` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StockReservation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VendorOffer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WhatsAppMessage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Wholesaler` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WholesalerProduct` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WholesalerRating` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'WHOLESALER', 'RETAILER', 'SUPPORT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'PENDING_BIDS', 'CREDIT_APPROVED', 'STOCK_RESERVED', 'WHOLESALER_ACCEPTED', 'CONFIRMED', 'PROCESSING', 'PACKED', 'OUT_FOR_DELIVERY', 'SHIPPED', 'DELIVERED', 'FAILED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('COD', 'ONLINE', 'CHEQUE', 'BANK_TRANSFER', 'CASH');

-- CreateEnum
CREATE TYPE "StockReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'FULFILLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CreditStatus" AS ENUM ('ACTIVE', 'PAUSED', 'BLOCKED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "WebhookEventType" AS ENUM ('ORDER_CREATED', 'ORDER_UPDATED', 'ORDER_CANCELLED', 'OFFER_SUBMITTED', 'OFFER_ACCEPTED', 'PAYMENT_RECEIVED', 'STOCK_UPDATED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'RETRYING');

-- AlterEnum
ALTER TYPE "LedgerEntryType" ADD VALUE 'REVERSAL';

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_retailerId_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_assignedToUserId_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_retailerId_fkey";

-- DropForeignKey
ALTER TABLE "ConversationMessage" DROP CONSTRAINT "ConversationMessage_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "CreditAccount" DROP CONSTRAINT "CreditAccount_retailerId_fkey";

-- DropForeignKey
ALTER TABLE "CreditHoldHistory" DROP CONSTRAINT "CreditHoldHistory_retailerId_fkey";

-- DropForeignKey
ALTER TABLE "CreditHoldHistory" DROP CONSTRAINT "CreditHoldHistory_wholesalerId_fkey";

-- DropForeignKey
ALTER TABLE "CreditTransaction" DROP CONSTRAINT "CreditTransaction_retailerId_fkey";

-- DropForeignKey
ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_orderId_fkey";

-- DropForeignKey
ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_retailerId_fkey";

-- DropForeignKey
ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_wholesalerId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_retailerId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_wholesalerId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "OrderRouting" DROP CONSTRAINT "OrderRouting_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderRouting" DROP CONSTRAINT "OrderRouting_retailerId_fkey";

-- DropForeignKey
ALTER TABLE "OrderRouting" DROP CONSTRAINT "OrderRouting_selectedWholesalerId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "RetailerPayment" DROP CONSTRAINT "RetailerPayment_ledgerEntryId_fkey";

-- DropForeignKey
ALTER TABLE "RetailerPayment" DROP CONSTRAINT "RetailerPayment_retailerId_fkey";

-- DropForeignKey
ALTER TABLE "RetailerPayment" DROP CONSTRAINT "RetailerPayment_wholesalerId_fkey";

-- DropForeignKey
ALTER TABLE "RetailerWholesalerCredit" DROP CONSTRAINT "RetailerWholesalerCredit_retailerId_fkey";

-- DropForeignKey
ALTER TABLE "RetailerWholesalerCredit" DROP CONSTRAINT "RetailerWholesalerCredit_wholesalerId_fkey";

-- DropForeignKey
ALTER TABLE "StockReservation" DROP CONSTRAINT "StockReservation_orderId_fkey";

-- DropForeignKey
ALTER TABLE "StockReservation" DROP CONSTRAINT "StockReservation_wholesalerProductId_fkey";

-- DropForeignKey
ALTER TABLE "VendorOffer" DROP CONSTRAINT "VendorOffer_order_id_fkey";

-- DropForeignKey
ALTER TABLE "VendorOffer" DROP CONSTRAINT "VendorOffer_wholesaler_id_fkey";

-- DropForeignKey
ALTER TABLE "WholesalerProduct" DROP CONSTRAINT "WholesalerProduct_productId_fkey";

-- DropForeignKey
ALTER TABLE "WholesalerProduct" DROP CONSTRAINT "WholesalerProduct_wholesalerId_fkey";

-- DropForeignKey
ALTER TABLE "WholesalerRating" DROP CONSTRAINT "WholesalerRating_orderId_fkey";

-- DropForeignKey
ALTER TABLE "WholesalerRating" DROP CONSTRAINT "WholesalerRating_retailerId_fkey";

-- DropForeignKey
ALTER TABLE "WholesalerRating" DROP CONSTRAINT "WholesalerRating_wholesalerId_fkey";

-- DropTable
DROP TABLE "AdminAuditLog";

-- DropTable
DROP TABLE "AuditLog";

-- DropTable
DROP TABLE "Category";

-- DropTable
DROP TABLE "Conversation";

-- DropTable
DROP TABLE "ConversationMessage";

-- DropTable
DROP TABLE "CreditAccount";

-- DropTable
DROP TABLE "CreditHoldHistory";

-- DropTable
DROP TABLE "CreditTransaction";

-- DropTable
DROP TABLE "LedgerEntry";

-- DropTable
DROP TABLE "Order";

-- DropTable
DROP TABLE "OrderItem";

-- DropTable
DROP TABLE "OrderRouting";

-- DropTable
DROP TABLE "PendingOrder";

-- DropTable
DROP TABLE "Product";

-- DropTable
DROP TABLE "Retailer";

-- DropTable
DROP TABLE "RetailerInsight";

-- DropTable
DROP TABLE "RetailerPayment";

-- DropTable
DROP TABLE "RetailerWholesalerCredit";

-- DropTable
DROP TABLE "StockReservation";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "VendorOffer";

-- DropTable
DROP TABLE "WhatsAppMessage";

-- DropTable
DROP TABLE "Wholesaler";

-- DropTable
DROP TABLE "WholesalerProduct";

-- DropTable
DROP TABLE "WholesalerRating";

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "whatsappNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retailers" (
    "id" TEXT NOT NULL,
    "pasalName" TEXT,
    "ownerName" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "email" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "city" TEXT,
    "district" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "conversationState" TEXT,
    "creditStatus" "CreditStatus" NOT NULL DEFAULT 'ACTIVE',
    "creditPausedAt" TIMESTAMP(3),
    "creditPauseReason" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retailers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wholesalers" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "email" TEXT,
    "gstNumber" TEXT,
    "businessAddress" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "reliabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "completedOrders" INTEGER NOT NULL DEFAULT 0,
    "cancelledOrders" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "capacity" INTEGER NOT NULL DEFAULT 10,
    "currentOrders" INTEGER NOT NULL DEFAULT 0,
    "categories" TEXT NOT NULL,
    "deliveryRadius" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "minimumOrder" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "deliveryCharges" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "operatingHours" TEXT NOT NULL DEFAULT '{"monday":{"open":"09:00","close":"18:00"},"tuesday":{"open":"09:00","close":"18:00"},"wednesday":{"open":"09:00","close":"18:00"},"thursday":{"open":"09:00","close":"18:00"},"friday":{"open":"09:00","close":"18:00"},"saturday":{"open":"09:00","close":"14:00"},"sunday":{"closed":true}}',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wholesalers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "unit" TEXT,
    "fixedPrice" DECIMAL(65,30) NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wholesaler_products" (
    "id" TEXT NOT NULL,
    "wholesalerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceOffered" DECIMAL(65,30) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "reservedStock" INTEGER NOT NULL DEFAULT 0,
    "minOrderQuantity" INTEGER NOT NULL DEFAULT 1,
    "leadTime" INTEGER NOT NULL DEFAULT 24,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wholesaler_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "wholesalerId" TEXT,
    "finalWholesalerId" TEXT,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL DEFAULT 'COD',
    "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    "confirmedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "priceAtOrder" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_offers" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "wholesalerId" TEXT NOT NULL,
    "priceQuote" DECIMAL(65,30) NOT NULL,
    "deliveryEta" TEXT NOT NULL,
    "stockConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_reservations" (
    "id" TEXT NOT NULL,
    "wholesalerProductId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "StockReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_routing" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "productRequested" TEXT NOT NULL,
    "candidateWholesalers" TEXT NOT NULL,
    "selectedWholesalerId" TEXT,
    "routingReason" TEXT NOT NULL,
    "routingScore" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_routing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_accounts" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "creditLimit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "usedCredit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "maxOrderValue" DECIMAL(65,30) NOT NULL DEFAULT 50000,
    "maxOutstandingDays" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retailer_wholesaler_credits" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "wholesalerId" TEXT NOT NULL,
    "creditLimit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "creditTerms" INTEGER NOT NULL DEFAULT 30,
    "interestRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "blockedReason" TEXT,
    "blockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retailer_wholesaler_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "wholesalerId" TEXT NOT NULL,
    "orderId" TEXT,
    "entryType" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "balanceAfter" DECIMAL(65,30) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "createdBy" "LedgerEntryCreator" NOT NULL DEFAULT 'SYSTEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retailer_payments" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "wholesalerId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL,
    "chequeNumber" TEXT,
    "chequeDate" TIMESTAMP(3),
    "bankName" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "clearedDate" TIMESTAMP(3),
    "ledgerEntryId" TEXT,
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retailer_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_hold_history" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "wholesalerId" TEXT NOT NULL,
    "holdReason" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "releasedAt" TIMESTAMP(3),
    "releasedBy" TEXT,
    "releasedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_hold_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "orderId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "type" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "reminderSentAt" TIMESTAMP(3),
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "clearedAt" TIMESTAMP(3),
    "clearedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'admin',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reference" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "performedBy" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "eventType" "WebhookEventType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'PENDING',
    "responseCode" INTEGER,
    "responseBody" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wholesaler_ratings" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "wholesalerId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "deliveryTime" INTEGER NOT NULL,
    "productQuality" INTEGER NOT NULL,
    "communication" INTEGER NOT NULL,
    "comment" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wholesaler_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_conflict_logs" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "attemptedBy" TEXT,
    "conflictReason" TEXT NOT NULL,
    "finalWholesalerId" TEXT,
    "attemptedWholesalerId" TEXT,
    "orderStatus" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_conflict_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "resolvedNotes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isFromRetailer" BOOLEAN NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "senderUserId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_orders" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "cartItems" TEXT NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "followUpSentAt" TIMESTAMP(3),
    "recoveredOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retailer_insights" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "ordersThisWeek" INTEGER NOT NULL DEFAULT 0,
    "ordersLastWeek" INTEGER NOT NULL DEFAULT 0,
    "ordersThisMonth" INTEGER NOT NULL DEFAULT 0,
    "avgOrderValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalSpent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "daysActive" INTEGER NOT NULL DEFAULT 0,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retailer_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_userId_key" ON "admins"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admins_phoneNumber_key" ON "admins"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "admins_whatsappNumber_key" ON "admins"("whatsappNumber");

-- CreateIndex
CREATE INDEX "admins_email_idx" ON "admins"("email");

-- CreateIndex
CREATE INDEX "admins_phoneNumber_idx" ON "admins"("phoneNumber");

-- CreateIndex
CREATE INDEX "admins_deletedAt_idx" ON "admins"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "users_whatsappNumber_key" ON "users"("whatsappNumber");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_phoneNumber_idx" ON "users"("phoneNumber");

-- CreateIndex
CREATE INDEX "users_whatsappNumber_idx" ON "users"("whatsappNumber");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "retailers_phoneNumber_key" ON "retailers"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "retailers_whatsappNumber_key" ON "retailers"("whatsappNumber");

-- CreateIndex
CREATE UNIQUE INDEX "retailers_email_key" ON "retailers"("email");

-- CreateIndex
CREATE INDEX "retailers_phoneNumber_idx" ON "retailers"("phoneNumber");

-- CreateIndex
CREATE INDEX "retailers_whatsappNumber_idx" ON "retailers"("whatsappNumber");

-- CreateIndex
CREATE INDEX "retailers_email_idx" ON "retailers"("email");

-- CreateIndex
CREATE INDEX "retailers_status_idx" ON "retailers"("status");

-- CreateIndex
CREATE INDEX "retailers_city_idx" ON "retailers"("city");

-- CreateIndex
CREATE INDEX "retailers_creditStatus_idx" ON "retailers"("creditStatus");

-- CreateIndex
CREATE INDEX "retailers_deletedAt_idx" ON "retailers"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "wholesalers_phoneNumber_key" ON "wholesalers"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "wholesalers_whatsappNumber_key" ON "wholesalers"("whatsappNumber");

-- CreateIndex
CREATE UNIQUE INDEX "wholesalers_email_key" ON "wholesalers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "wholesalers_gstNumber_key" ON "wholesalers"("gstNumber");

-- CreateIndex
CREATE INDEX "wholesalers_phoneNumber_idx" ON "wholesalers"("phoneNumber");

-- CreateIndex
CREATE INDEX "wholesalers_whatsappNumber_idx" ON "wholesalers"("whatsappNumber");

-- CreateIndex
CREATE INDEX "wholesalers_email_idx" ON "wholesalers"("email");

-- CreateIndex
CREATE INDEX "wholesalers_gstNumber_idx" ON "wholesalers"("gstNumber");

-- CreateIndex
CREATE INDEX "wholesalers_city_idx" ON "wholesalers"("city");

-- CreateIndex
CREATE INDEX "wholesalers_isActive_idx" ON "wholesalers"("isActive");

-- CreateIndex
CREATE INDEX "wholesalers_isVerified_idx" ON "wholesalers"("isVerified");

-- CreateIndex
CREATE INDEX "wholesalers_deletedAt_idx" ON "wholesalers"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_slug_idx" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_isActive_idx" ON "categories"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- CreateIndex
CREATE INDEX "products_slug_idx" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_isActive_idx" ON "products"("isActive");

-- CreateIndex
CREATE INDEX "products_deletedAt_idx" ON "products"("deletedAt");

-- CreateIndex
CREATE INDEX "wholesaler_products_wholesalerId_idx" ON "wholesaler_products"("wholesalerId");

-- CreateIndex
CREATE INDEX "wholesaler_products_productId_idx" ON "wholesaler_products"("productId");

-- CreateIndex
CREATE INDEX "wholesaler_products_isAvailable_idx" ON "wholesaler_products"("isAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "wholesaler_products_wholesalerId_productId_key" ON "wholesaler_products"("wholesalerId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_retailerId_idx" ON "orders"("retailerId");

-- CreateIndex
CREATE INDEX "orders_wholesalerId_idx" ON "orders"("wholesalerId");

-- CreateIndex
CREATE INDEX "orders_finalWholesalerId_idx" ON "orders"("finalWholesalerId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_orderNumber_idx" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- CreateIndex
CREATE INDEX "orders_expiresAt_idx" ON "orders"("expiresAt");

-- CreateIndex
CREATE INDEX "orders_deletedAt_idx" ON "orders"("deletedAt");

-- CreateIndex
CREATE INDEX "orders_retailerId_status_idx" ON "orders"("retailerId", "status");

-- CreateIndex
CREATE INDEX "orders_wholesalerId_status_idx" ON "orders"("wholesalerId", "status");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");

-- CreateIndex
CREATE INDEX "vendor_offers_orderId_idx" ON "vendor_offers"("orderId");

-- CreateIndex
CREATE INDEX "vendor_offers_wholesalerId_idx" ON "vendor_offers"("wholesalerId");

-- CreateIndex
CREATE INDEX "vendor_offers_status_idx" ON "vendor_offers"("status");

-- CreateIndex
CREATE INDEX "vendor_offers_createdAt_idx" ON "vendor_offers"("createdAt");

-- CreateIndex
CREATE INDEX "vendor_offers_orderId_status_idx" ON "vendor_offers"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_offers_orderId_wholesalerId_key" ON "vendor_offers"("orderId", "wholesalerId");

-- CreateIndex
CREATE INDEX "stock_reservations_orderId_idx" ON "stock_reservations"("orderId");

-- CreateIndex
CREATE INDEX "stock_reservations_wholesalerProductId_idx" ON "stock_reservations"("wholesalerProductId");

-- CreateIndex
CREATE INDEX "stock_reservations_status_idx" ON "stock_reservations"("status");

-- CreateIndex
CREATE INDEX "stock_reservations_createdAt_idx" ON "stock_reservations"("createdAt");

-- CreateIndex
CREATE INDEX "order_routing_orderId_idx" ON "order_routing"("orderId");

-- CreateIndex
CREATE INDEX "order_routing_retailerId_idx" ON "order_routing"("retailerId");

-- CreateIndex
CREATE INDEX "order_routing_selectedWholesalerId_idx" ON "order_routing"("selectedWholesalerId");

-- CreateIndex
CREATE INDEX "order_routing_timestamp_idx" ON "order_routing"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "credit_accounts_retailerId_key" ON "credit_accounts"("retailerId");

-- CreateIndex
CREATE INDEX "credit_accounts_retailerId_idx" ON "credit_accounts"("retailerId");

-- CreateIndex
CREATE INDEX "retailer_wholesaler_credits_retailerId_idx" ON "retailer_wholesaler_credits"("retailerId");

-- CreateIndex
CREATE INDEX "retailer_wholesaler_credits_wholesalerId_idx" ON "retailer_wholesaler_credits"("wholesalerId");

-- CreateIndex
CREATE INDEX "retailer_wholesaler_credits_isActive_idx" ON "retailer_wholesaler_credits"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "retailer_wholesaler_credits_retailerId_wholesalerId_key" ON "retailer_wholesaler_credits"("retailerId", "wholesalerId");

-- CreateIndex
CREATE INDEX "ledger_entries_retailerId_wholesalerId_idx" ON "ledger_entries"("retailerId", "wholesalerId");

-- CreateIndex
CREATE INDEX "ledger_entries_orderId_idx" ON "ledger_entries"("orderId");

-- CreateIndex
CREATE INDEX "ledger_entries_entryType_idx" ON "ledger_entries"("entryType");

-- CreateIndex
CREATE INDEX "ledger_entries_createdAt_idx" ON "ledger_entries"("createdAt");

-- CreateIndex
CREATE INDEX "ledger_entries_dueDate_idx" ON "ledger_entries"("dueDate");

-- CreateIndex
CREATE INDEX "ledger_entries_retailerId_wholesalerId_createdAt_idx" ON "ledger_entries"("retailerId", "wholesalerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "retailer_payments_ledgerEntryId_key" ON "retailer_payments"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "retailer_payments_retailerId_idx" ON "retailer_payments"("retailerId");

-- CreateIndex
CREATE INDEX "retailer_payments_wholesalerId_idx" ON "retailer_payments"("wholesalerId");

-- CreateIndex
CREATE INDEX "retailer_payments_status_idx" ON "retailer_payments"("status");

-- CreateIndex
CREATE INDEX "retailer_payments_recordedAt_idx" ON "retailer_payments"("recordedAt");

-- CreateIndex
CREATE INDEX "credit_hold_history_retailerId_idx" ON "credit_hold_history"("retailerId");

-- CreateIndex
CREATE INDEX "credit_hold_history_wholesalerId_idx" ON "credit_hold_history"("wholesalerId");

-- CreateIndex
CREATE INDEX "credit_hold_history_isActive_idx" ON "credit_hold_history"("isActive");

-- CreateIndex
CREATE INDEX "credit_hold_history_createdAt_idx" ON "credit_hold_history"("createdAt");

-- CreateIndex
CREATE INDEX "credit_transactions_retailerId_idx" ON "credit_transactions"("retailerId");

-- CreateIndex
CREATE INDEX "credit_transactions_orderId_idx" ON "credit_transactions"("orderId");

-- CreateIndex
CREATE INDEX "credit_transactions_status_idx" ON "credit_transactions"("status");

-- CreateIndex
CREATE INDEX "credit_transactions_dueDate_idx" ON "credit_transactions"("dueDate");

-- CreateIndex
CREATE INDEX "admin_audit_logs_adminId_idx" ON "admin_audit_logs"("adminId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");

-- CreateIndex
CREATE INDEX "admin_audit_logs_targetId_idx" ON "admin_audit_logs"("targetId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "admin_audit_logs_adminId_createdAt_idx" ON "admin_audit_logs"("adminId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_adminId_idx" ON "api_keys"("adminId");

-- CreateIndex
CREATE INDEX "api_keys_keyHash_idx" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_isActive_idx" ON "api_keys"("isActive");

-- CreateIndex
CREATE INDEX "api_keys_scope_idx" ON "api_keys"("scope");

-- CreateIndex
CREATE INDEX "api_keys_expiresAt_idx" ON "api_keys"("expiresAt");

-- CreateIndex
CREATE INDEX "audit_logs_retailerId_idx" ON "audit_logs"("retailerId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "webhook_logs_eventType_idx" ON "webhook_logs"("eventType");

-- CreateIndex
CREATE INDEX "webhook_logs_entityId_entityType_idx" ON "webhook_logs"("entityId", "entityType");

-- CreateIndex
CREATE INDEX "webhook_logs_status_idx" ON "webhook_logs"("status");

-- CreateIndex
CREATE INDEX "webhook_logs_createdAt_idx" ON "webhook_logs"("createdAt");

-- CreateIndex
CREATE INDEX "webhook_logs_nextRetryAt_idx" ON "webhook_logs"("nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "wholesaler_ratings_orderId_key" ON "wholesaler_ratings"("orderId");

-- CreateIndex
CREATE INDEX "wholesaler_ratings_wholesalerId_idx" ON "wholesaler_ratings"("wholesalerId");

-- CreateIndex
CREATE INDEX "wholesaler_ratings_retailerId_idx" ON "wholesaler_ratings"("retailerId");

-- CreateIndex
CREATE INDEX "wholesaler_ratings_timestamp_idx" ON "wholesaler_ratings"("timestamp");

-- CreateIndex
CREATE INDEX "decision_conflict_logs_orderId_idx" ON "decision_conflict_logs"("orderId");

-- CreateIndex
CREATE INDEX "decision_conflict_logs_attemptedBy_idx" ON "decision_conflict_logs"("attemptedBy");

-- CreateIndex
CREATE INDEX "decision_conflict_logs_createdAt_idx" ON "decision_conflict_logs"("createdAt");

-- CreateIndex
CREATE INDEX "conversations_retailerId_idx" ON "conversations"("retailerId");

-- CreateIndex
CREATE INDEX "conversations_assignedToUserId_idx" ON "conversations"("assignedToUserId");

-- CreateIndex
CREATE INDEX "conversations_status_idx" ON "conversations"("status");

-- CreateIndex
CREATE INDEX "conversation_messages_conversationId_idx" ON "conversation_messages"("conversationId");

-- CreateIndex
CREATE INDEX "conversation_messages_timestamp_idx" ON "conversation_messages"("timestamp");

-- CreateIndex
CREATE INDEX "whatsapp_messages_from_idx" ON "whatsapp_messages"("from");

-- CreateIndex
CREATE INDEX "whatsapp_messages_to_idx" ON "whatsapp_messages"("to");

-- CreateIndex
CREATE INDEX "whatsapp_messages_createdAt_idx" ON "whatsapp_messages"("createdAt");

-- CreateIndex
CREATE INDEX "pending_orders_retailerId_idx" ON "pending_orders"("retailerId");

-- CreateIndex
CREATE INDEX "pending_orders_status_idx" ON "pending_orders"("status");

-- CreateIndex
CREATE INDEX "pending_orders_expiresAt_idx" ON "pending_orders"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "retailer_insights_retailerId_key" ON "retailer_insights"("retailerId");

-- CreateIndex
CREATE INDEX "retailer_insights_retailerId_idx" ON "retailer_insights"("retailerId");

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wholesaler_products" ADD CONSTRAINT "wholesaler_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wholesaler_products" ADD CONSTRAINT "wholesaler_products_wholesalerId_fkey" FOREIGN KEY ("wholesalerId") REFERENCES "wholesalers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_wholesalerId_fkey" FOREIGN KEY ("wholesalerId") REFERENCES "wholesalers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_offers" ADD CONSTRAINT "vendor_offers_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_offers" ADD CONSTRAINT "vendor_offers_wholesalerId_fkey" FOREIGN KEY ("wholesalerId") REFERENCES "wholesalers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_wholesalerProductId_fkey" FOREIGN KEY ("wholesalerProductId") REFERENCES "wholesaler_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_routing" ADD CONSTRAINT "order_routing_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_routing" ADD CONSTRAINT "order_routing_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_routing" ADD CONSTRAINT "order_routing_selectedWholesalerId_fkey" FOREIGN KEY ("selectedWholesalerId") REFERENCES "wholesalers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retailer_wholesaler_credits" ADD CONSTRAINT "retailer_wholesaler_credits_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retailer_wholesaler_credits" ADD CONSTRAINT "retailer_wholesaler_credits_wholesalerId_fkey" FOREIGN KEY ("wholesalerId") REFERENCES "wholesalers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_wholesalerId_fkey" FOREIGN KEY ("wholesalerId") REFERENCES "wholesalers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retailer_payments" ADD CONSTRAINT "retailer_payments_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retailer_payments" ADD CONSTRAINT "retailer_payments_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retailer_payments" ADD CONSTRAINT "retailer_payments_wholesalerId_fkey" FOREIGN KEY ("wholesalerId") REFERENCES "wholesalers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_hold_history" ADD CONSTRAINT "credit_hold_history_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_hold_history" ADD CONSTRAINT "credit_hold_history_wholesalerId_fkey" FOREIGN KEY ("wholesalerId") REFERENCES "wholesalers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wholesaler_ratings" ADD CONSTRAINT "wholesaler_ratings_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wholesaler_ratings" ADD CONSTRAINT "wholesaler_ratings_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wholesaler_ratings" ADD CONSTRAINT "wholesaler_ratings_wholesalerId_fkey" FOREIGN KEY ("wholesalerId") REFERENCES "wholesalers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_conflict_logs" ADD CONSTRAINT "decision_conflict_logs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
