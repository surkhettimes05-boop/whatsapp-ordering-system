-- Standalone WhatsApp commerce: richer catalog, persistent carts, checkout metadata
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CHECKED_OUT', 'ABANDONED');
CREATE TYPE "OrderChannel" AS ENUM ('WHATSAPP', 'ADMIN', 'API');

ALTER TABLE "products"
  ADD COLUMN "sku" TEXT,
  ADD COLUMN "brand" TEXT,
  ADD COLUMN "packSize" TEXT,
  ADD COLUMN "mrp" DECIMAL(65,30);

CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

ALTER TABLE "orders"
  ADD COLUMN "sourceChannel" "OrderChannel" NOT NULL DEFAULT 'WHATSAPP',
  ADD COLUMN "deliveryName" TEXT,
  ADD COLUMN "deliveryPhone" TEXT,
  ADD COLUMN "deliveryAddress" TEXT,
  ADD COLUMN "customerNotes" TEXT;

CREATE TABLE "carts" (
  "id" TEXT NOT NULL,
  "retailerId" TEXT NOT NULL,
  "activeKey" TEXT,
  "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
  "currency" TEXT NOT NULL DEFAULT 'NPR',
  "checkoutOrderId" TEXT,
  "checkedOutAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cart_items" (
  "id" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(65,30) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "carts_activeKey_key" ON "carts"("activeKey");
CREATE INDEX "carts_retailerId_idx" ON "carts"("retailerId");
CREATE INDEX "carts_status_idx" ON "carts"("status");
CREATE INDEX "carts_createdAt_idx" ON "carts"("createdAt");
CREATE UNIQUE INDEX "cart_items_cartId_productId_key" ON "cart_items"("cartId", "productId");
CREATE INDEX "cart_items_cartId_idx" ON "cart_items"("cartId");
CREATE INDEX "cart_items_productId_idx" ON "cart_items"("productId");

ALTER TABLE "carts"
  ADD CONSTRAINT "carts_retailerId_fkey"
  FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cart_items"
  ADD CONSTRAINT "cart_items_cartId_fkey"
  FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cart_items"
  ADD CONSTRAINT "cart_items_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
