-- Complete Jio-style shopping parity: campaign offers, richer saved addresses,
-- flexible serviceability and Nepal payment metadata.

ALTER TABLE "categories"
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "categories_sortOrder_idx" ON "categories"("sortOrder");

ALTER TABLE "commerce_addresses"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "service_areas"
  ADD COLUMN "name" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "keywords" TEXT;
CREATE INDEX "service_areas_district_idx" ON "service_areas"("district");
CREATE INDEX "service_areas_postalCode_idx" ON "service_areas"("postalCode");

ALTER TABLE "carts"
  ADD COLUMN "couponCode" TEXT,
  ADD COLUMN "selectedAddressId" TEXT,
  ADD COLUMN "paymentProvider" TEXT;

ALTER TABLE "orders"
  ADD COLUMN "deliveryFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "savingsAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "paymentProvider" TEXT,
  ADD COLUMN "serviceAreaCode" TEXT;

CREATE TABLE "commerce_offers" (
  "id" TEXT NOT NULL,
  "code" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL,
  "value" DECIMAL(65,30) NOT NULL,
  "minOrderAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "maxDiscount" DECIMAL(65,30),
  "categoryId" TEXT,
  "productId" TEXT,
  "autoApply" BOOLEAN NOT NULL DEFAULT false,
  "usageLimit" INTEGER,
  "perCustomerLimit" INTEGER NOT NULL DEFAULT 1,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commerce_offers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "commerce_offers_code_key" ON "commerce_offers"("code");
CREATE INDEX "commerce_offers_code_idx" ON "commerce_offers"("code");
CREATE INDEX "commerce_offers_isActive_startsAt_endsAt_idx" ON "commerce_offers"("isActive","startsAt","endsAt");
CREATE INDEX "commerce_offers_categoryId_idx" ON "commerce_offers"("categoryId");
CREATE INDEX "commerce_offers_productId_idx" ON "commerce_offers"("productId");

CREATE TABLE "commerce_offer_redemptions" (
  "id" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "retailerId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commerce_offer_redemptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "commerce_offer_redemptions_offerId_idx" ON "commerce_offer_redemptions"("offerId");
CREATE INDEX "commerce_offer_redemptions_retailerId_idx" ON "commerce_offer_redemptions"("retailerId");
CREATE INDEX "commerce_offer_redemptions_orderId_idx" ON "commerce_offer_redemptions"("orderId");
ALTER TABLE "commerce_offer_redemptions"
  ADD CONSTRAINT "commerce_offer_redemptions_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "commerce_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
