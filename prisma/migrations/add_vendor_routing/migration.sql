-- CreateTable VendorRouting
CREATE TABLE "vendor_routings" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "eligibleVendors" TEXT NOT NULL,
    "lockedWholesalerId" TEXT,
    "lockedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_routings_pkey" PRIMARY KEY ("id")
);

-- CreateTable VendorResponse
CREATE TABLE "vendor_responses" (
    "id" TEXT NOT NULL,
    "vendorRoutingId" TEXT NOT NULL,
    "wholesalerId" TEXT NOT NULL,
    "responseType" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "responseTime" INTEGER,
    "payload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable VendorCancellation
CREATE TABLE "vendor_cancellations" (
    "id" TEXT NOT NULL,
    "vendorResponseId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_cancellations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_routings_orderId_lockedWholesalerId_key" ON "vendor_routings"("orderId", "lockedWholesalerId");

-- CreateIndex
CREATE INDEX "vendor_routings_orderId_idx" ON "vendor_routings"("orderId");

-- CreateIndex
CREATE INDEX "vendor_routings_retailerId_idx" ON "vendor_routings"("retailerId");

-- CreateIndex
CREATE INDEX "vendor_routings_lockedWholesalerId_idx" ON "vendor_routings"("lockedWholesalerId");

-- CreateIndex
CREATE INDEX "vendor_routings_createdAt_idx" ON "vendor_routings"("createdAt");

-- CreateIndex
CREATE INDEX "vendor_routings_orderId_lockedWholesalerId_idx" ON "vendor_routings"("orderId", "lockedWholesalerId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_responses_vendorRoutingId_wholesalerId_key" ON "vendor_responses"("vendorRoutingId", "wholesalerId");

-- CreateIndex
CREATE INDEX "vendor_responses_vendorRoutingId_idx" ON "vendor_responses"("vendorRoutingId");

-- CreateIndex
CREATE INDEX "vendor_responses_wholesalerId_idx" ON "vendor_responses"("wholesalerId");

-- CreateIndex
CREATE INDEX "vendor_responses_responseType_idx" ON "vendor_responses"("responseType");

-- CreateIndex
CREATE INDEX "vendor_responses_acceptedAt_idx" ON "vendor_responses"("acceptedAt");

-- CreateIndex
CREATE INDEX "vendor_responses_createdAt_idx" ON "vendor_responses"("createdAt");

-- CreateIndex
CREATE INDEX "vendor_responses_vendorRoutingId_responseType_idx" ON "vendor_responses"("vendorRoutingId", "responseType");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_cancellations_vendorResponseId_key" ON "vendor_cancellations"("vendorResponseId");

-- CreateIndex
CREATE INDEX "vendor_cancellations_reason_idx" ON "vendor_cancellations"("reason");

-- CreateIndex
CREATE INDEX "vendor_cancellations_sentAt_idx" ON "vendor_cancellations"("sentAt");

-- CreateIndex
CREATE INDEX "vendor_cancellations_confirmedAt_idx" ON "vendor_cancellations"("confirmedAt");

-- AddForeignKey
ALTER TABLE "vendor_routings" ADD CONSTRAINT "vendor_routings_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_routings" ADD CONSTRAINT "vendor_routings_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_routings" ADD CONSTRAINT "vendor_routings_lockedWholesalerId_fkey" FOREIGN KEY ("lockedWholesalerId") REFERENCES "wholesalers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_responses" ADD CONSTRAINT "vendor_responses_vendorRoutingId_fkey" FOREIGN KEY ("vendorRoutingId") REFERENCES "vendor_routings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_responses" ADD CONSTRAINT "vendor_responses_wholesalerId_fkey" FOREIGN KEY ("wholesalerId") REFERENCES "wholesalers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_cancellations" ADD CONSTRAINT "vendor_cancellations_vendorResponseId_fkey" FOREIGN KEY ("vendorResponseId") REFERENCES "vendor_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
