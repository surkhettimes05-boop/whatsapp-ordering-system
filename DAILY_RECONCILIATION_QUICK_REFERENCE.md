# Daily Reconciliation - Quick Reference

## What It Does

Automatically runs every day at 2 AM UTC to verify:
- Ledger integrity (debits = credits for closed orders)
- Order-to-ledger mapping (every order has ledger entries)
- Amount matching (order total = ledger sum)
- Duplicate detection (no duplicate ledger entries)

**Output:** Audit report with reconciliation status

---

## Quick Start

### 1. Add to App Startup

In `src/index.js`:
```javascript
const { initializeReconciliation, shutdownReconciliation } 
  = require('./jobs/daily-reconciliation.job');

const reconcResult = await initializeReconciliation({
  schedule: '0 2 * * *', // 2 AM UTC daily
  run_on_start: false
});

process.on('SIGTERM', () => {
  shutdownReconciliation(reconcResult.scheduler);
});
```

### 2. Test CLI Command

```bash
npm run reconcile
```

Runs reconciliation immediately and displays report.

---

## Usage

### Run Today's Reconciliation
```bash
npm run reconcile
```

### Run Specific Date
```bash
npm run reconcile -- --date 2024-01-15
```

### Export Report
```bash
# JSON
npm run reconcile -- --export json --output ./report.json

# CSV
npm run reconcile -- --export csv --output ./report.csv

# TXT
npm run reconcile -- --export txt --output ./report.txt
```

### All Options
```
--date, -d        Date to reconcile (YYYY-MM-DD, default: today)
--detailed, -v    Include detailed breakdown (default: true)
--export, -e      Format: json|csv|txt (default: txt)
--output, -o      Output file (optional)
--save, -s        Save to database (default: true)
--alerts, -a      Send alerts (default: false)
--help, -h        Show help
```

---

## Report Example

```
╔════════════════════════════════════════════════════════════════════╗
║                    DAILY RECONCILIATION REPORT                      ║
╚════════════════════════════════════════════════════════════════════╝

Report Date: 2024-01-15
Status: MATCHED (0 mismatches)

┌─ LEDGER SUMMARY ─────────────────────────────────────┐
│ Total Entries:                                    1234│
│ Total Debits:                        ₹5,67,890.00    │
│ Total Credits:                       ₹5,60,123.45    │
│ Net Position:                          ₹-7,766.55    │
└──────────────────────────────────────────────────────┘

┌─ ORDERS SUMMARY ─────────────────────────────────────┐
│ Outstanding Orders:                               45 │
│ Pending Amount:                      ₹4,56,789.00    │
└──────────────────────────────────────────────────────┘

┌─ RECONCILIATION ─────────────────────────────────────┐
│ Variance:                              ₹0.00          │
│ Variance %:                            0.00%          │
│ Status:                                BALANCED       │
│ Bookkeeping Balanced:                  YES            │
└──────────────────────────────────────────────────────┘

Completed in: 324ms
```

---

## What Gets Checked

### ✅ Ledger Analysis
- Sum all debits (money owed)
- Sum all credits (money received)
- Verify net position
- Count entries by type

### ✅ Orders Analysis
- Count outstanding orders
- Sum pending amounts
- Group by status
- Check age (today vs older)

### ✅ Reconciliation
- Variance = |Ledger - Orders|
- Check if bookkeeping balanced
- Flag if variance > threshold

### ✅ Mismatch Detection
- Orders without ledger entries
- Ledger entries without orders
- Amount mismatches
- Duplicate ledger entries

---

## Output Types

### Console (Default)
Displays ASCII table with color coding.

### JSON
```json
{
  "status": "MATCHED",
  "statistics": {...},
  "mismatches": [],
  "ledger": {...},
  "orders": {...}
}
```

### CSV
Spreadsheet-compatible format.

### TXT
Formatted text report for printing/email.

---

## Troubleshooting

### Command not found: reconcile
```bash
# Reinstall dependencies
npm install

# Verify script in package.json
grep "reconcile" package.json
```

### Reconciliation fails
```bash
# Check database connection
npm run check

# Check logs
tail -f logs/app.log | grep -i reconcil

# Run with verbose output
npm run reconcile -- --save false
```

### High variance detected
```bash
# Check for orders without ledger
npm run reconcile -- --detailed

# Query database
psql -d whatsapp_ordering -c \
  "SELECT order_id, COUNT(*) FROM ledger_entries GROUP BY order_id HAVING COUNT(*) > 1;"
```

---

## Database Storage

Reconciliation reports are stored in `financial_reconciliations` table.

```bash
# View latest reports
psql -d whatsapp_ordering -c \
  "SELECT reconciliation_date, is_matched, discrepancy FROM financial_reconciliations ORDER BY completed_at DESC LIMIT 5;"

# Find mismatches
psql -d whatsapp_ordering -c \
  "SELECT * FROM financial_reconciliations WHERE is_matched = false ORDER BY completed_at DESC;"

# Export to CSV
psql -d whatsapp_ordering -c \
  "COPY (SELECT reconciliation_date, is_matched, system_amount, external_amount FROM financial_reconciliations ORDER BY reconciliation_date DESC) TO STDOUT WITH CSV HEADER;" > reconciliation_history.csv
```

---

## Monitoring

### Logs to Watch
```bash
# Reconciliation started
grep "reconciliation job started" logs/app.log

# Reconciliation completed
grep "reconciliation job completed" logs/app.log

# Mismatches found
grep "RECONCILIATION ALERT" logs/app.log

# Scheduled runs
grep "reconciliation scheduled task triggered" logs/app.log
```

### Metrics
- **Success Rate:** % of matched reconciliations
- **Average Duration:** Milliseconds to complete
- **Mismatch Frequency:** How often mismatches occur
- **Variance Trend:** Variance over time

---

## Integration

### Email Alerts
Configure in environment:
```bash
ALERT_EMAIL=finance@company.com
```

### Slack Alerts
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### API Endpoint (Optional)
```javascript
// Add to Express app
app.get('/api/reconciliation/latest', async (req, res) => {
  const latest = await prisma.financialReconciliation.findFirst({
    orderBy: { completedAt: 'desc' }
  });
  res.json(latest);
});
```

---

## Files

**Code:**
- `src/services/reconciliation.service.js` (450 lines)
- `src/jobs/daily-reconciliation.job.js` (300 lines)
- `src/cli/reconcile.js` (350 lines)

**Documentation:**
- `DAILY_RECONCILIATION.md` (Complete guide)
- `DAILY_RECONCILIATION_QUICK_REFERENCE.md` (This file)

---

## Common Tasks

### View reconciliation status
```bash
npm run reconcile
```

### Reconcile past date
```bash
npm run reconcile -- --date 2024-01-10
```

### Fix and re-reconcile
```bash
# Fix database issues
psql -d whatsapp_ordering -c "... fix queries ..."

# Re-run reconciliation
npm run reconcile
```

### Export for audit
```bash
npm run reconcile -- --export json \
  --output /archive/reconciliation_2024_01.json
```

### Schedule custom time
In code: Change schedule from `'0 2 * * *'` to desired cron pattern.

---

## Next Steps

1. **Enable:** Add to app startup
2. **Test:** Run `npm run reconcile`
3. **Monitor:** Check logs and database
4. **Alert:** Setup email/Slack notifications
5. **Archive:** Export reports monthly for compliance

---

*Fintech auditor tool for daily financial reconciliation and compliance.*
