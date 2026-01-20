# Financial & Audit Tables - Quick Reference

## Schema Summary

| Table | Purpose | Records | Growth Rate |
|-------|---------|---------|------------|
| `financial_reports` | Period financial summaries | 30-100/month | Slow |
| `transaction_audits` | Transaction audit trail | 1000s/day | High |
| `financial_reconciliations` | Bank reconciliation records | 100s/month | Slow |
| `financial_snapshots` | Point-in-time snapshots | 1000s/month | Moderate |
| `compliance_logs` | Compliance check records | 100s/month | Slow |
| `system_audit_logs` | System operation logs | 100s/day | Moderate |

## Quick Query Examples

### FinancialReport - Get Last Month's Report
```sql
SELECT * FROM "financial_reports"
WHERE "reportType" = 'MONTHLY'
  AND "reportDate" >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY "reportDate" DESC
LIMIT 1;
```

### TransactionAudit - Audit Trail for Order
```sql
SELECT * FROM "transaction_audits"
WHERE "referenceId" = 'order-123'
ORDER BY "requestedAt" DESC;
```

### TransactionAudit - Pending Approvals
```sql
SELECT * FROM "transaction_audits"
WHERE "status" = 'PENDING'
  AND "action" = 'APPROVE'
ORDER BY "requestedAt" ASC;
```

### FinancialReconciliation - Find Discrepancies
```sql
SELECT * FROM "financial_reconciliations"
WHERE "isMatched" = false
  AND "resolutionStatus" = 'PENDING'
ORDER BY "reconciliationDate" DESC;
```

### FinancialSnapshot - Credit Utilization Trend
```sql
SELECT 
  "snapshotDate",
  "totalCreditUsed" / "totalCreditLimit" as "utilization_rate",
  "overdueCreditAmount"
FROM "financial_snapshots"
WHERE "snapshotType" = 'DAILY'
  AND "retailerId" = 'retailer-123'
  AND "snapshotDate" >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY "snapshotDate" DESC;
```

### ComplianceLog - Tax Compliance Status
```sql
SELECT * FROM "compliance_logs"
WHERE "complianceType" = 'TAX'
  AND "isCompliant" = false
ORDER BY "createdAt" DESC;
```

### SystemAuditLog - Recent Config Changes
```sql
SELECT * FROM "system_audit_logs"
WHERE "action" = 'CONFIG_UPDATE'
  AND "status" = 'SUCCESS'
ORDER BY "createdAt" DESC
LIMIT 20;
```

## Prisma Client Usage Examples

### Create Transaction Audit Entry
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Log a payment processing
await prisma.transactionAudit.create({
  data: {
    transactionId: 'payment-456',
    transactionType: 'PAYMENT',
    referenceId: 'order-123',
    retailerId: 'retailer-789',
    initiatedBy: 'admin-user',
    amount: new Decimal('5000.00'),
    status: 'PENDING',
    action: 'CREATE',
    reason: 'Payment received from bank',
    metadata: JSON.stringify({
      bankName: 'NMB Bank',
      transactionRef: 'NMB2025011201234'
    })
  }
});
```

### Generate Financial Report
```typescript
// Calculate daily report
const report = await prisma.financialReport.create({
  data: {
    reportDate: new Date(),
    reportType: 'DAILY',
    
    // Order metrics
    totalOrders: await prisma.order.count(),
    completedOrders: await prisma.order.count({ 
      where: { status: 'DELIVERED' } 
    }),
    
    // Financial metrics
    totalOrderValue: await calculateTotalOrderValue(),
    totalTax: await calculateTotalTax(),
    totalPaid: await calculateTotalPaid(),
    
    generatedBy: 'admin-user-id'
  }
});
```

### Query Financial Snapshots
```typescript
// Get credit utilization for specific retailer
const snapshots = await prisma.financialSnapshot.findMany({
  where: {
    retailerId: 'retailer-123',
    snapshotType: 'DAILY',
    snapshotDate: {
      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
    }
  },
  orderBy: { snapshotDate: 'desc' }
});

// Calculate average credit utilization
const avgUtilization = snapshots.reduce((sum, s) => 
  sum + (s.totalCreditUsed / s.totalCreditLimit), 0
) / snapshots.length;
```

### Run Reconciliation
```typescript
// Reconcile payments
const reconciliation = await prisma.financialReconciliation.create({
  data: {
    reconciliationType: 'BANK',
    reconciliationDate: new Date(),
    bankName: 'NMB Bank',
    
    // System totals
    systemAmount: await calculateSystemAmount(),
    
    // Bank statement amount
    externalAmount: new Decimal('100000.00'),
    
    discrepancy: systemAmount.minus(externalAmount),
    isMatched: systemAmount.equals(externalAmount),
    
    resolutionStatus: systemAmount.equals(externalAmount) ? 'RESOLVED' : 'MANUAL_REVIEW'
  }
});
```

### Log Compliance Check
```typescript
// Verify VAT compliance
await prisma.complianceLog.create({
  data: {
    complianceType: 'TAX',
    requirement: 'VAT Compliance - 13% tax rate on all orders',
    applicableTo: null, // System-wide
    
    isCompliant: true,
    checkPerformedAt: new Date(),
    checkPerformedBy: 'admin-compliance',
    
    evidence: JSON.stringify({
      taxRate: 13,
      checkedOrders: 150,
      correctRate: 150,
      rate: '100%'
    })
  }
});
```

### Log System Audit
```typescript
// Track schema migration
await prisma.systemAuditLog.create({
  data: {
    action: 'SCHEMA_CHANGE',
    component: 'database',
    performedBy: 'system-migration',
    
    description: 'Added financial and audit tables',
    impact: 'HIGH',
    status: 'SUCCESS',
    
    newValue: JSON.stringify({
      tablesAdded: 6,
      columnsAdded: 140,
      indexesAdded: 30
    }),
    
    recordsAffected: 0,
    metadata: JSON.stringify({
      migrationId: '20250122_add_financial_and_audit_tables',
      duration: '2.5 seconds'
    })
  }
});
```

## Common Workflows

### Workflow 1: Process & Audit Payment
```typescript
async function processPaymentWithAudit(orderId: string, amount: Decimal) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  
  // Create payment
  const payment = await prisma.retailerPayment.create({
    data: {
      retailerId: order.retailerId,
      amount,
      status: 'PENDING'
    }
  });
  
  // Audit the payment
  await prisma.transactionAudit.create({
    data: {
      transactionId: payment.id,
      transactionType: 'PAYMENT',
      referenceId: orderId,
      retailerId: order.retailerId,
      initiatedBy: 'system',
      amount,
      status: 'PENDING',
      action: 'CREATE',
      reason: 'Automatic payment processing for order'
    }
  });
  
  return payment;
}
```

### Workflow 2: Daily Financial Report Generation
```typescript
async function generateDailyReport(date: Date = new Date()) {
  const orders = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: new Date(date).toDateString(),
        lt: new Date(date.getTime() + 24 * 60 * 60 * 1000).toDateString()
      }
    }
  });
  
  const totalOrderValue = orders.reduce((sum, o) => 
    sum.plus(o.subtotal), new Decimal(0)
  );
  
  const report = await prisma.financialReport.create({
    data: {
      reportDate: date,
      reportType: 'DAILY',
      totalOrders: orders.length,
      completedOrders: orders.filter(o => o.status === 'DELIVERED').length,
      totalOrderValue,
      totalTax: totalOrderValue.times(0.13),
      totalGross: totalOrderValue.times(1.13),
      generatedBy: 'system'
    }
  });
  
  return report;
}
```

### Workflow 3: Find & Resolve Discrepancies
```typescript
async function reviewReconciliationIssues() {
  // Find unmatched reconciliations
  const issues = await prisma.financialReconciliation.findMany({
    where: {
      isMatched: false,
      resolutionStatus: 'PENDING'
    },
    orderBy: { reconciliationDate: 'desc' }
  });
  
  for (const issue of issues) {
    console.log(`Discrepancy: ${issue.discrepancy} on ${issue.reconciliationDate}`);
    
    // Find related transactions
    const transactions = await prisma.transactionAudit.findMany({
      where: {
        requestedAt: {
          gte: new Date(issue.startedAt),
          lte: new Date(issue.completedAt || new Date())
        }
      }
    });
    
    console.log(`Related transactions: ${transactions.length}`);
  }
}
```

## Maintenance Tasks

### Daily
- Generate FinancialReport for previous day
- Check for pending TransactionAudit approvals
- Review SystemAuditLog for errors

### Weekly
- Run FinancialReconciliation
- Archive completed reconciliations
- Review ComplianceLog for issues

### Monthly
- Generate monthly FinancialReport
- Archive monthly FinancialSnapshots
- Clean up old SystemAuditLogs (>90 days)
- Review ComplianceLog compliance rate

### Quarterly
- Archive quarterly FinancialReport
- Full system audit review
- Compliance report to stakeholders

## Database Indexes Performance Tips

All indexes are optimized for these queries:
- Status/type filtering with date range
- Sorting by timestamp
- Joining on IDs
- Aggregating by date/type

Use `EXPLAIN ANALYZE` before complex queries:
```sql
EXPLAIN ANALYZE
SELECT * FROM "transaction_audits"
WHERE "status" = 'COMPLETED'
  AND "createdAt" >= '2025-01-22'
ORDER BY "amount" DESC;
```

## Monitoring & Alerts

### Alert: High Discrepancy Rate
```sql
SELECT COUNT(*) FROM "financial_reconciliations"
WHERE "isMatched" = false
  AND "createdAt" >= CURRENT_DATE - INTERVAL '7 days';
-- Alert if > 5 in last 7 days
```

### Alert: Pending Approvals
```sql
SELECT COUNT(*) FROM "transaction_audits"
WHERE "status" = 'PENDING'
  AND "action" = 'APPROVE'
  AND "requestedAt" < CURRENT_TIMESTAMP - INTERVAL '1 day';
-- Alert if any older than 24 hours
```

### Alert: Compliance Issues
```sql
SELECT COUNT(*) FROM "compliance_logs"
WHERE "isCompliant" = false
  AND "remediationCompleted" IS NULL;
-- Alert if any unresolved
```

## Related Documentation

- [Schema Completion Guide](./SCHEMA_COMPLETION_FINANCIAL_AUDIT.md)
- [Credit System Documentation](./CREDIT_LEDGER_SYSTEM.md)
- [Order System Architecture](./ARCHITECTURE.md)
- [API Reference](./API_REFERENCE.md)
