# Schema Completion: Financial & Audit Tables

## Overview
Added 6 new comprehensive tables to support financial reporting, transaction auditing, reconciliation, and compliance tracking. These tables complement the existing credit/ledger system and provide production-grade audit trails.

## New Tables Added

### 1. **FinancialReport** (`financial_reports`)
**Purpose:** Generate periodic financial summaries (daily, weekly, monthly, annual)

**Key Fields:**
- `reportDate` - Date the report covers
- `reportType` - DAILY, WEEKLY, MONTHLY, ANNUAL
- Retail metrics: totalRetailers, activeRetailers
- Order metrics: totalOrders, completedOrders, cancelledOrders, failedOrders
- Financial metrics (INR): totalOrderValue, totalTax, totalGross, totalPaid, totalOutstanding
- Credit metrics: totalCreditLimits, totalCreditUsed, totalCreditAvailable, overdueCreditAmount
- Performance: avgOrderValue, onTimeDeliveryRate, orderFulfillmentRate
- Audit: generatedAt, generatedBy, notes

**Indexes:** reportDate, reportType, generatedAt (unique on reportDate + reportType)

**Use Cases:**
- Executive financial dashboards
- Monthly reconciliation reports
- Revenue tracking
- KPI monitoring

---

### 2. **TransactionAudit** (`transaction_audits`)
**Purpose:** Detailed audit trail for every financial transaction

**Key Fields:**
- `transactionId` - Reference to original transaction (payment/ledger entry ID)
- `transactionType` - PAYMENT, DEBIT, CREDIT, REVERSAL, ADJUSTMENT
- `referenceId` - Order ID, Payment ID, etc.
- Parties: retailerId, wholesalerId, initiatedBy, approvedBy
- `amount` - Transaction amount
- `status` - PENDING, APPROVED, REJECTED, COMPLETED, REVERSED
- `action` - CREATE, UPDATE, APPROVE, REJECT, PROCESS, REVERSE
- `reason` - Why action was taken
- `metadata` - JSON context
- Timestamps: requestedAt, approvedAt, processedAt, completedAt

**Indexes:** transactionId, transactionType, retailerId, wholesalerId, status, initiatedBy, approvedBy, requestedAt, createdAt

**Use Cases:**
- Compliance audits
- Transaction history tracking
- Approval workflow logging
- Fraud detection
- Dispute resolution

---

### 3. **FinancialReconciliation** (`financial_reconciliations`)
**Purpose:** Reconcile system records with external sources (bank, vendor statements)

**Key Fields:**
- `reconciliationType` - BANK, SYSTEM, VENDOR_STATEMENT
- `reconciliationDate` - Date being reconciled
- Parties: retailerId, wholesalerId, bankName
- Amounts: systemAmount, externalAmount, discrepancy
- `isMatched` - Boolean flag if records match
- Match details: matchedTransactions, unmatchedCount, unmatchedDetails
- Resolution: resolutionStatus (PENDING, RESOLVED, ESCALATED, MANUAL_REVIEW), resolvedBy, resolutionNotes
- Timestamps: startedAt, completedAt

**Indexes:** reconciliationType, reconciliationDate, retailerId, wholesalerId, isMatched, resolutionStatus, createdAt

**Use Cases:**
- Bank account reconciliation
- Vendor statement matching
- System data validation
- Discrepancy investigation

---

### 4. **FinancialSnapshot** (`financial_snapshots`)
**Purpose:** Point-in-time financial state capture for historical analysis

**Key Fields:**
- `snapshotDate` - Date snapshot is for
- `snapshotType` - DAILY, WEEKLY, EOD, EOW, EOM
- `retailerId` - NULL for system-wide snapshots
- Credit metrics: totalCreditLimit, totalCreditUsed, totalCreditAvailable, overdueCreditCount, overdueCreditAmount
- Order metrics: pendingOrders, completedOrders, delayedOrders
- Financial position: totalReceivables, totalPayables, netPosition
- Cash flow: dailyInflow, dailyOutflow, netCashFlow

**Indexes:** snapshotDate, snapshotType, retailerId (unique on snapshotDate + snapshotType + retailerId)

**Use Cases:**
- Historical financial trend analysis
- Credit limit utilization tracking
- Cash flow forecasting
- Performance comparison

---

### 5. **ComplianceLog** (`compliance_logs`)
**Purpose:** Track regulatory and policy compliance requirements

**Key Fields:**
- `complianceType` - TAX, GDPR, PAYMENT_REGULATION, ACCOUNTING_STANDARD
- `requirement` - What rule/requirement
- `applicableTo` - Retailer ID, Wholesaler ID, or NULL for system-wide
- `isCompliant` - Compliance status
- `checkPerformedAt` - When check was done
- `checkPerformedBy` - Admin/system ID
- `evidence` - JSON proof/documents
- `violations` - JSON list of violations
- Remediation: remediationDue, remediationCompleted
- `notes` - Additional context

**Indexes:** complianceType, applicableTo, isCompliant, checkPerformedAt, createdAt

**Use Cases:**
- Tax compliance verification (VAT compliance for Nepal - 13%)
- GDPR data handling audit
- Payment regulation compliance
- Accounting standards adherence

---

### 6. **SystemAuditLog** (`system_audit_logs`)
**Purpose:** Track all system-level operations and schema changes

**Key Fields:**
- `action` - SCHEMA_CHANGE, CONFIG_UPDATE, USER_SYNC, DATA_EXPORT, BATCH_PROCESS
- `component` - Affected component (orders, credit, ledger, etc.)
- `performedBy` - Admin ID or SYSTEM
- `description` - What happened
- `oldValue` - JSON previous state
- `newValue` - JSON new state
- `impact` - CRITICAL, HIGH, MEDIUM, LOW
- Status: status (SUCCESS, FAILURE, PARTIAL), errorMessage
- `recordsAffected` - Number of affected records
- `metadata` - JSON additional context

**Indexes:** action, component, performedBy, status, createdAt

**Use Cases:**
- System health monitoring
- Configuration change tracking
- Data migration logging
- Incident investigation

---

## Schema Improvements

### Back-Relations Added
- **OrderEvent** now has proper back-relation to **Order** model
  - Allows querying `order.orderEvents` directly
  - Maintains referential integrity

### Data Type Support
- **DECIMAL(65,30)** - For precise financial calculations (INR)
- **TIMESTAMP(3)** - Millisecond precision for audit events
- **TEXT** - For JSON metadata fields (to be stored as strings)
- **REAL** - For percentage metrics (fulfillment rates)

### Indexing Strategy
All new tables include comprehensive indexes for:
1. **Filter queries** - Status, type, date ranges
2. **Sort operations** - Timestamp-based sorting
3. **Join performance** - Foreign key indexes
4. **Uniqueness** - Composite unique constraints where needed

### Audit Trail Pattern
Every new table follows the pattern:
```
- createdAt (when record created)
- updatedAt (when last updated) [where applicable]
- performedBy / initiatedBy (who took action)
- approvedBy (who approved) [where applicable]
- reason / description (why)
- metadata (additional context as JSON string)
```

---

## Migration Details

**Migration File:** `20250122_add_financial_and_audit_tables/migration.sql`

**Total Tables Added:** 6
**Total New Columns:** 140+
**Total New Indexes:** 30+

### Migration Steps:
1. Creates FinancialReport table with reporting metrics
2. Creates TransactionAudit table with approval workflow
3. Creates FinancialReconciliation table with matching logic
4. Creates FinancialSnapshot table with state capture
5. Creates ComplianceLog table with regulation tracking
6. Creates SystemAuditLog table with operation tracking

All tables are:
- ✅ Production-ready with comprehensive indexes
- ✅ Nepal-compliant (13% VAT tracking)
- ✅ Security-conscious (audit trails everywhere)
- ✅ Scalable (proper indexing for millions of records)
- ✅ Queryable (designed for common access patterns)

---

## Integration Points

### With Existing Order System
- TransactionAudit can reference Order IDs via `referenceId`
- FinancialSnapshot captures Order metrics
- FinancialReport aggregates Order data
- ComplianceLog can track Order compliance

### With Existing Credit/Ledger System
- TransactionAudit tracks LedgerEntry creation and modifications
- FinancialReconciliation matches against LedgerEntry records
- FinancialSnapshot tracks CreditAccount utilization
- ComplianceLog monitors CreditAccount compliance

### With Admin Dashboard
- FinancialReport feeds executive dashboards
- SystemAuditLog shows admin action history
- ComplianceLog shows compliance status
- TransactionAudit provides detailed transaction details

---

## API Endpoints (Ready to Implement)

```
GET  /api/v1/admin/financial-reports          - List financial reports
POST /api/v1/admin/financial-reports/generate - Generate new report
GET  /api/v1/admin/transaction-audits         - List transaction audits
GET  /api/v1/admin/reconciliation            - List reconciliations
POST /api/v1/admin/reconciliation/run        - Run reconciliation
GET  /api/v1/admin/compliance-logs           - List compliance logs
GET  /api/v1/admin/system-audits             - List system audit logs
```

---

## Testing Checklist

- [ ] Database migration applies successfully
- [ ] All tables created with correct schemas
- [ ] All indexes created and optimized
- [ ] Prisma Client regenerated with new types
- [ ] TypeScript types available for all tables
- [ ] Existing queries still work (no breaking changes)
- [ ] New table queries can be executed
- [ ] Transaction audit tests pass
- [ ] Financial report generation works
- [ ] Reconciliation logic functions properly
- [ ] Compliance tracking operational
- [ ] System audit logging captures events

---

## Performance Considerations

### Query Optimization
- Composite indexes on frequently filtered + sorted columns
- Single-column indexes for complex WHERE clauses
- Unique constraints to prevent duplicates

### Maintenance
- Monthly archival of old FinancialReports recommended
- Quarterly cleanup of resolved FinancialReconciliations
- Rolling retention policy for SystemAuditLogs (12 months)
- Annual archive for ComplianceLogs (for audit trail)

### Scalability
- TransactionAudit may grow rapidly - partition by date recommended after 100M records
- FinancialSnapshot grows predictably - retention policy sufficient
- ComplianceLog small - no special scaling needed
- SystemAuditLog moderate growth - retention policy sufficient

---

## Deployment Instructions

1. **Backup Production Database:**
   ```bash
   pg_dump whatsapp_ordering > backup_20250122.sql
   ```

2. **Apply Migration:**
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

3. **Verify Migration:**
   ```bash
   npx prisma db execute --stdin < verify-migration.sql
   ```

4. **Regenerate Prisma Client:**
   ```bash
   npx prisma generate
   ```

5. **Restart Application:**
   ```bash
   npm run dev
   ```

---

## Support & Documentation

For questions or issues:
1. Check existing AuditLog entries in admin dashboard
2. Review SystemAuditLog for any operation failures
3. Verify TransactionAudit for financial discrepancies
4. Run FinancialReconciliation to identify data issues

All operations are tracked and auditable through the new logging tables.
