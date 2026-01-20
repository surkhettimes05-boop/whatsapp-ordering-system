-- ============================================================================
-- AddColumn: Add orderEvents back-relation to Order model
-- ============================================================================
-- This adds the back-relation for OrderEvent records to properly reference Order

-- Note: orderEvents array is implicit in Prisma and doesn't need explicit SQL

-- ============================================================================
-- CreateTable: FinancialReport
-- ============================================================================
CREATE TABLE "financial_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "reportType" TEXT NOT NULL,
    "totalRetailers" INTEGER NOT NULL DEFAULT 0,
    "activeRetailers" INTEGER NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "completedOrders" INTEGER NOT NULL DEFAULT 0,
    "cancelledOrders" INTEGER NOT NULL DEFAULT 0,
    "failedOrders" INTEGER NOT NULL DEFAULT 0,
    "totalOrderValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalGross" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalPaid" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalOutstanding" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalCreditLimits" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalCreditUsed" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalCreditAvailable" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "overdueCreditAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "avgOrderValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "onTimeDeliveryRate" REAL NOT NULL DEFAULT 0,
    "orderFulfillmentRate" REAL NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "financial_reports_reportDate_idx" ON "financial_reports"("reportDate");
CREATE INDEX "financial_reports_reportType_idx" ON "financial_reports"("reportType");
CREATE INDEX "financial_reports_generatedAt_idx" ON "financial_reports"("generatedAt");
CREATE UNIQUE INDEX "financial_reports_reportDate_reportType_key" ON "financial_reports"("reportDate", "reportType");

-- ============================================================================
-- CreateTable: TransactionAudit
-- ============================================================================
CREATE TABLE "transaction_audits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "referenceId" TEXT,
    "retailerId" TEXT NOT NULL,
    "wholesalerId" TEXT,
    "initiatedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL,
    "previousStatus" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "transaction_audits_transactionId_idx" ON "transaction_audits"("transactionId");
CREATE INDEX "transaction_audits_transactionType_idx" ON "transaction_audits"("transactionType");
CREATE INDEX "transaction_audits_retailerId_idx" ON "transaction_audits"("retailerId");
CREATE INDEX "transaction_audits_wholesalerId_idx" ON "transaction_audits"("wholesalerId");
CREATE INDEX "transaction_audits_status_idx" ON "transaction_audits"("status");
CREATE INDEX "transaction_audits_initiatedBy_idx" ON "transaction_audits"("initiatedBy");
CREATE INDEX "transaction_audits_approvedBy_idx" ON "transaction_audits"("approvedBy");
CREATE INDEX "transaction_audits_requestedAt_idx" ON "transaction_audits"("requestedAt");
CREATE INDEX "transaction_audits_createdAt_idx" ON "transaction_audits"("createdAt");

-- ============================================================================
-- CreateTable: FinancialReconciliation
-- ============================================================================
CREATE TABLE "financial_reconciliations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reconciliationType" TEXT NOT NULL,
    "reconciliationDate" TIMESTAMP(3) NOT NULL,
    "retailerId" TEXT,
    "wholesalerId" TEXT,
    "bankName" TEXT,
    "systemAmount" DECIMAL(65,30) NOT NULL,
    "externalAmount" DECIMAL(65,30) NOT NULL,
    "discrepancy" DECIMAL(65,30) NOT NULL,
    "isMatched" BOOLEAN NOT NULL DEFAULT false,
    "matchedTransactions" INTEGER NOT NULL DEFAULT 0,
    "unmatchedCount" INTEGER NOT NULL DEFAULT 0,
    "unmatchedDetails" TEXT,
    "resolutionStatus" TEXT NOT NULL,
    "resolvedBy" TEXT,
    "resolutionNotes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "financial_reconciliations_reconciliationType_idx" ON "financial_reconciliations"("reconciliationType");
CREATE INDEX "financial_reconciliations_reconciliationDate_idx" ON "financial_reconciliations"("reconciliationDate");
CREATE INDEX "financial_reconciliations_retailerId_idx" ON "financial_reconciliations"("retailerId");
CREATE INDEX "financial_reconciliations_wholesalerId_idx" ON "financial_reconciliations"("wholesalerId");
CREATE INDEX "financial_reconciliations_isMatched_idx" ON "financial_reconciliations"("isMatched");
CREATE INDEX "financial_reconciliations_resolutionStatus_idx" ON "financial_reconciliations"("resolutionStatus");
CREATE INDEX "financial_reconciliations_createdAt_idx" ON "financial_reconciliations"("createdAt");

-- ============================================================================
-- CreateTable: FinancialSnapshot
-- ============================================================================
CREATE TABLE "financial_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "snapshotType" TEXT NOT NULL,
    "retailerId" TEXT,
    "totalRetailers" INTEGER NOT NULL DEFAULT 0,
    "totalCreditLimit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalCreditUsed" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalCreditAvailable" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "overdueCreditCount" INTEGER NOT NULL DEFAULT 0,
    "overdueCreditAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "pendingOrders" INTEGER NOT NULL DEFAULT 0,
    "completedOrders" INTEGER NOT NULL DEFAULT 0,
    "delayedOrders" INTEGER NOT NULL DEFAULT 0,
    "totalReceivables" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalPayables" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netPosition" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "dailyInflow" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "dailyOutflow" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netCashFlow" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "financial_snapshots_snapshotDate_idx" ON "financial_snapshots"("snapshotDate");
CREATE INDEX "financial_snapshots_snapshotType_idx" ON "financial_snapshots"("snapshotType");
CREATE INDEX "financial_snapshots_retailerId_idx" ON "financial_snapshots"("retailerId");
CREATE UNIQUE INDEX "financial_snapshots_snapshotDate_snapshotType_retailerId_key" ON "financial_snapshots"("snapshotDate", "snapshotType", "retailerId");

-- ============================================================================
-- CreateTable: ComplianceLog
-- ============================================================================
CREATE TABLE "compliance_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "complianceType" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "applicableTo" TEXT,
    "isCompliant" BOOLEAN NOT NULL DEFAULT false,
    "checkPerformedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkPerformedBy" TEXT,
    "evidence" TEXT,
    "violations" TEXT,
    "remediationDue" TIMESTAMP(3),
    "remediationCompleted" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "compliance_logs_complianceType_idx" ON "compliance_logs"("complianceType");
CREATE INDEX "compliance_logs_applicableTo_idx" ON "compliance_logs"("applicableTo");
CREATE INDEX "compliance_logs_isCompliant_idx" ON "compliance_logs"("isCompliant");
CREATE INDEX "compliance_logs_checkPerformedAt_idx" ON "compliance_logs"("checkPerformedAt");
CREATE INDEX "compliance_logs_createdAt_idx" ON "compliance_logs"("createdAt");

-- ============================================================================
-- CreateTable: SystemAuditLog
-- ============================================================================
CREATE TABLE "system_audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "impact" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "recordsAffected" INTEGER,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "system_audit_logs_action_idx" ON "system_audit_logs"("action");
CREATE INDEX "system_audit_logs_component_idx" ON "system_audit_logs"("component");
CREATE INDEX "system_audit_logs_performedBy_idx" ON "system_audit_logs"("performedBy");
CREATE INDEX "system_audit_logs_status_idx" ON "system_audit_logs"("status");
CREATE INDEX "system_audit_logs_createdAt_idx" ON "system_audit_logs"("createdAt");
