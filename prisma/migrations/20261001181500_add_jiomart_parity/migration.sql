ALTER TABLE "categories" ADD COLUMN "parentId" TEXT;
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");
ALTER TABLE "categories"
  ADD CONSTRAINT "categories_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- JioMart-style WhatsApp parity: Meta catalog identity, saved addresses,
-- serviceability, online-payment attempts, support tickets and webhook idempotency.

CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

ALTER TABLE "products" ADD COLUMN "metaRetailerId" TEXT;
CREATE UNIQUE INDEX "products_metaRetailerId_key" ON "products"("metaRetailerId");

ALTER TABLE "orders"
  ADD COLUMN "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "paymentReference" TEXT,
  ADD COLUMN "paymentUrl" TEXT,
  ADD COLUMN "couponCode" TEXT;

-- Preserve existing order totals as subtotal for historical rows.
UPDATE "orders" SET "subtotal" = "totalAmount" WHERE "subtotal" = 0;

CREATE TABLE "commerce_addresses" (
  "id" TEXT NOT NULL,
  "retailerId" TEXT NOT NULL,
  "label" TEXT NOT NULL DEFAULT 'Home',
  "recipientName" TEXT,
  "phone" TEXT,
  "addressLine1" TEXT NOT NULL,
  "city" TEXT,
  "district" TEXT,
  "postalCode" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commerce_addresses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_areas" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "city" TEXT,
  "district" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "minOrder" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "deliveryFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "etaText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_areas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commerce_payment_transactions" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NPR',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "externalId" TEXT,
  "checkoutUrl" TEXT,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commerce_payment_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commerce_support_tickets" (
  "id" TEXT NOT NULL,
  "ticketNumber" TEXT NOT NULL,
  "retailerId" TEXT NOT NULL,
  "orderId" TEXT,
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "SupportPriority" NOT NULL DEFAULT 'MEDIUM',
  "resolution" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "commerce_support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "whatsapp_inbound_events" (
  "id" TEXT NOT NULL,
  "providerMessageId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "sender" TEXT,
  "messageType" TEXT,
  "payload" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "whatsapp_inbound_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_areas_code_key" ON "service_areas"("code");
CREATE INDEX "service_areas_isActive_idx" ON "service_areas"("isActive");
CREATE INDEX "service_areas_city_idx" ON "service_areas"("city");
CREATE INDEX "commerce_addresses_retailerId_idx" ON "commerce_addresses"("retailerId");
CREATE INDEX "commerce_addresses_retailerId_isDefault_idx" ON "commerce_addresses"("retailerId", "isDefault");
CREATE INDEX "commerce_addresses_postalCode_idx" ON "commerce_addresses"("postalCode");
CREATE UNIQUE INDEX "commerce_payment_transactions_externalId_key" ON "commerce_payment_transactions"("externalId");
CREATE INDEX "commerce_payment_transactions_orderId_idx" ON "commerce_payment_transactions"("orderId");
CREATE INDEX "commerce_payment_transactions_status_idx" ON "commerce_payment_transactions"("status");
CREATE INDEX "commerce_payment_transactions_provider_idx" ON "commerce_payment_transactions"("provider");
CREATE UNIQUE INDEX "commerce_support_tickets_ticketNumber_key" ON "commerce_support_tickets"("ticketNumber");
CREATE INDEX "commerce_support_tickets_retailerId_idx" ON "commerce_support_tickets"("retailerId");
CREATE INDEX "commerce_support_tickets_orderId_idx" ON "commerce_support_tickets"("orderId");
CREATE INDEX "commerce_support_tickets_status_idx" ON "commerce_support_tickets"("status");
CREATE INDEX "commerce_support_tickets_createdAt_idx" ON "commerce_support_tickets"("createdAt");
CREATE UNIQUE INDEX "whatsapp_inbound_events_providerMessageId_key" ON "whatsapp_inbound_events"("providerMessageId");
CREATE INDEX "whatsapp_inbound_events_provider_idx" ON "whatsapp_inbound_events"("provider");
CREATE INDEX "whatsapp_inbound_events_sender_idx" ON "whatsapp_inbound_events"("sender");
CREATE INDEX "whatsapp_inbound_events_createdAt_idx" ON "whatsapp_inbound_events"("createdAt");

ALTER TABLE "commerce_addresses"
  ADD CONSTRAINT "commerce_addresses_retailerId_fkey"
  FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "commerce_payment_transactions"
  ADD CONSTRAINT "commerce_payment_transactions_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "commerce_support_tickets"
  ADD CONSTRAINT "commerce_support_tickets_retailerId_fkey"
  FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "commerce_support_tickets"
  ADD CONSTRAINT "commerce_support_tickets_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
