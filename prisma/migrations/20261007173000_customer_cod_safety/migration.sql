-- AlterTable
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'RETAILER';

-- AlterTable
ALTER TABLE "retailers" ADD COLUMN     "catalogProductIds" TEXT;

-- AlterTable
ALTER TABLE "whatsapp_inbound_events" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "whatsapp_outbox" (
    "id" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_inventory_events" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "orderId" TEXT,
    "kind" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "physicalDelta" INTEGER NOT NULL,
    "reservedDelta" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commerce_inventory_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_outbox_sentAt_nextAttemptAt_idx" ON "whatsapp_outbox"("sentAt", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "commerce_inventory_events_reference_key" ON "commerce_inventory_events"("reference");

-- CreateIndex
CREATE INDEX "commerce_inventory_events_inventoryId_createdAt_idx" ON "commerce_inventory_events"("inventoryId", "createdAt");

-- CreateIndex
CREATE INDEX "commerce_inventory_events_orderId_idx" ON "commerce_inventory_events"("orderId");


-- Physical stock and reservations remain valid even when writes bypass the API.
ALTER TABLE wholesaler_products ADD CONSTRAINT commerce_stock_nonnegative
CHECK (stock >= 0 AND "reservedStock" >= 0 AND "reservedStock" <= stock) NOT VALID;
ALTER TABLE cart_items ADD CONSTRAINT commerce_cart_quantity CHECK (quantity > 0 AND quantity <= 10000) NOT VALID;
ALTER TABLE commerce_inventory_events ADD CONSTRAINT commerce_inventory_event_quantity CHECK (quantity > 0);
CREATE OR REPLACE FUNCTION prevent_commerce_inventory_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Commerce inventory events are immutable'; END; $$;
CREATE TRIGGER immutable_commerce_inventory_events BEFORE UPDATE OR DELETE ON commerce_inventory_events
FOR EACH ROW EXECUTE FUNCTION prevent_commerce_inventory_event_mutation();
