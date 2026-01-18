-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Retailer" (
    "id" TEXT NOT NULL,
    "pasalName" TEXT,
    "ownerName" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "city" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "conversationState" TEXT,
    "creditStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "creditPausedAt" TIMESTAMP(3),
    "creditPauseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Retailer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wholesaler" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "email" TEXT,
    "gstNumber" TEXT,
    "businessAddress" TEXT NOT NULL,
    "city" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wholesaler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesalerProduct" (
    "id" TEXT NOT NULL,
    "wholesalerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceOffered" DECIMAL(65,30) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "minOrderQuantity" INTEGER NOT NULL DEFAULT 1,
    "leadTime" INTEGER NOT NULL DEFAULT 24,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "reservedStock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesalerProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReservation" (
    "id" TEXT NOT NULL,
    "wholesalerProductId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderRouting" (
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

    CONSTRAINT "OrderRouting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesalerRating" (
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

    CONSTRAINT "WholesalerRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "unit" TEXT,
    "fixedPrice" DECIMAL(65,30) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "wholesalerId" TEXT,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "priceAtOrder" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailerWholesalerCredit" (
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

    CONSTRAINT "RetailerWholesalerCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "wholesalerId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "orderId" TEXT,
    "paymentId" TEXT,
    "dueDate" TIMESTAMP(3),
    "description" TEXT,
    "approvalNotes" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailerPayment" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "wholesalerId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "chequeNumber" TEXT,
    "chequeDate" TIMESTAMP(3),
    "bankName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "clearedDate" TIMESTAMP(3),
    "ledgerEntryId" TEXT,
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetailerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditHoldHistory" (
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

    CONSTRAINT "CreditHoldHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditAccount" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "creditLimit" DECIMAL(65,30) NOT NULL,
    "usedCredit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "maxOrderValue" DECIMAL(65,30) NOT NULL DEFAULT 50000,
    "maxOutstandingDays" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
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

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reference" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "performedBy" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingOrder" (
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

    CONSTRAINT "PendingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailerInsight" (
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

    CONSTRAINT "RetailerInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
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

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isFromRetailer" BOOLEAN NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "senderUserId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminActionLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT,
    "reference" TEXT,
    "details" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Retailer_phoneNumber_key" ON "Retailer"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Wholesaler_phoneNumber_key" ON "Wholesaler"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Wholesaler_whatsappNumber_key" ON "Wholesaler"("whatsappNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Wholesaler_email_key" ON "Wholesaler"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Wholesaler_gstNumber_key" ON "Wholesaler"("gstNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WholesalerProduct_wholesalerId_productId_key" ON "WholesalerProduct"("wholesalerId", "productId");

-- CreateIndex
CREATE INDEX "StockReservation_orderId_idx" ON "StockReservation"("orderId");

-- CreateIndex
CREATE INDEX "StockReservation_wholesalerProductId_idx" ON "StockReservation"("wholesalerProductId");

-- CreateIndex
CREATE UNIQUE INDEX "WholesalerRating_orderId_key" ON "WholesalerRating"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "RetailerWholesalerCredit_retailerId_idx" ON "RetailerWholesalerCredit"("retailerId");

-- CreateIndex
CREATE INDEX "RetailerWholesalerCredit_wholesalerId_idx" ON "RetailerWholesalerCredit"("wholesalerId");

-- CreateIndex
CREATE UNIQUE INDEX "RetailerWholesalerCredit_retailerId_wholesalerId_key" ON "RetailerWholesalerCredit"("retailerId", "wholesalerId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_retailerId_idx" ON "CreditLedgerEntry"("retailerId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_wholesalerId_idx" ON "CreditLedgerEntry"("wholesalerId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_orderId_idx" ON "CreditLedgerEntry"("orderId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_paymentId_idx" ON "CreditLedgerEntry"("paymentId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_createdAt_idx" ON "CreditLedgerEntry"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RetailerPayment_ledgerEntryId_key" ON "RetailerPayment"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "RetailerPayment_retailerId_idx" ON "RetailerPayment"("retailerId");

-- CreateIndex
CREATE INDEX "RetailerPayment_wholesalerId_idx" ON "RetailerPayment"("wholesalerId");

-- CreateIndex
CREATE INDEX "RetailerPayment_status_idx" ON "RetailerPayment"("status");

-- CreateIndex
CREATE INDEX "CreditHoldHistory_retailerId_idx" ON "CreditHoldHistory"("retailerId");

-- CreateIndex
CREATE INDEX "CreditHoldHistory_isActive_idx" ON "CreditHoldHistory"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CreditAccount_retailerId_key" ON "CreditAccount"("retailerId");

-- CreateIndex
CREATE UNIQUE INDEX "RetailerInsight_retailerId_key" ON "RetailerInsight"("retailerId");

-- CreateIndex
CREATE INDEX "AdminActionLog_timestamp_idx" ON "AdminActionLog"("timestamp");

-- CreateIndex
CREATE INDEX "AdminActionLog_performedBy_idx" ON "AdminActionLog"("performedBy");

-- AddForeignKey
ALTER TABLE "WholesalerProduct" ADD CONSTRAINT "WholesalerProduct_wholesalerId_fkey" FOREIGN KEY ("wholesalerId") REFERENCES "Wholesaler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesalerProduct" ADD CONSTRAINT "WholesalerProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_wholesalerProductId_fkey" FOREIGN KEY ("wholesalerProductId") REFERENCES "WholesalerProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRouting" ADD CONSTRAINT "OrderRouting_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRouting" ADD CONSTRAINT "OrderRouting_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRouting" ADD CONSTRAINT "OrderRouting_selectedWholesalerId_fkey" FOREIGN KEY ("selectedWholesalerId") REFERENCES "Wholesaler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesalerRating" ADD CONSTRAINT "WholesalerRating_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesalerRating" ADD CONSTRAINT "WholesalerRating_wholesalerId_fkey" FOREIGN KEY ("wholesalerId") REFERENCES "Wholesaler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesalerRating" ADD CONSTRAINT "WholesalerRating_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_wholesalerId_fkey" FOREIGN KEY ("wholesalerId") REFERENCES "Wholesaler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerWholesalerCredit" ADD CONSTRAINT "RetailerWholesalerCredit_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerWholesalerCredit" ADD CONSTRAINT "RetailerWholesalerCredit_wholesalerId_fkey" FOREIGN KEY ("wholesalerId") REFERENCES "Wholesaler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_wholesalerId_fkey" FOREIGN KEY ("wholesalerId") REFERENCES "Wholesaler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerPayment" ADD CONSTRAINT "RetailerPayment_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerPayment" ADD CONSTRAINT "RetailerPayment_wholesalerId_fkey" FOREIGN KEY ("wholesalerId") REFERENCES "Wholesaler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerPayment" ADD CONSTRAINT "RetailerPayment_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "CreditLedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditHoldHistory" ADD CONSTRAINT "CreditHoldHistory_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditHoldHistory" ADD CONSTRAINT "CreditHoldHistory_wholesalerId_fkey" FOREIGN KEY ("wholesalerId") REFERENCES "Wholesaler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAccount" ADD CONSTRAINT "CreditAccount_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
