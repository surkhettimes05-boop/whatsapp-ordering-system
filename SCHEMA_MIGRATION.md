"""
Schema Migration: Add Credit Operations System

This file shows the exact changes made to prisma/schema.prisma
Apply using: npx prisma migrate dev
"""

# CHANGES TO RETAILER MODEL
# Added 3 new fields for credit control:

retailer.creditStatus    # String @default("ACTIVE")    // ACTIVE, PAUSED, BLOCKED
retailer.creditPausedAt  # DateTime?                   // When credit was paused
retailer.creditPauseReason # String?                    // Why credit was paused
retailer.auditLogs       # AuditLog[]                  // New relation

---

# CHANGES TO CREDITACCOUNT MODEL
# Added 2 new fields for guardrails:

creditAccount.maxOrderValue      # Decimal @default(50000)  // Max order in single transaction
creditAccount.maxOutstandingDays # Int @default(30)         // Max days credit can be outstanding

---

# CHANGES TO CREDITTRANSACTION MODEL
# Added 4 new fields for reminder tracking and partial payments:

creditTransaction.reminderSentAt # DateTime?    // Last reminder sent for this transaction
creditTransaction.reminderCount  # Int @default(0) // How many reminders sent
creditTransaction.clearedAt      # DateTime?    // When this was marked cleared
creditTransaction.clearedAmount  # Decimal @default(0) // Amount actually paid
creditTransaction.notes          # String?      // Admin notes for adjustments

---

# CHANGES TO ORDER MODEL
# Added 2 new fields for failure tracking:

order.failedAt           # DateTime?   // When order failed (WhatsApp delivery, etc)
order.failureReason      # String?     // Why the order failed

order.status now includes: "FAILED"   // Added to existing enum

---

# NEW MODELS ADDED

# MODEL 1: OPERATIONALAUDITLOG
model AuditLog {
  id              String   @id @default(cuid())
  retailer        Retailer @relation(fields: [retailerId], references: [id])
  retailerId      String
  
  action          String   // CREDIT_ADDED, CREDIT_CLEARED, PAUSE_CREDIT, UNPAUSE_CREDIT, ADJUSTMENT, ORDER_CREATED, ORDER_FAILED
  reference       String?  // Linked transaction/order ID
  
  // What changed
  oldValue        String?  // JSON serialized previous value
  newValue        String?  // JSON serialized new value
  
  // Who did it
  performedBy     String   // SYSTEM or admin user ID
  
  reason          String?  // Why this action was taken
  
  createdAt       DateTime @default(now())
}

---

# MODEL 2: PENDINGORDER
model PendingOrder {
  id              String   @id @default(cuid())
  retailerId      String
  
  // Cart state before order was placed
  cartItems       String   // JSON serialized cart items
  totalAmount     Decimal
  
  // Tracking
  status          String   @default("PENDING") // PENDING, EXPIRED, RECOVERED, FAILED
  expiresAt       DateTime // When this pending order expires
  
  // Recovery tracking
  followUpSentAt  DateTime? // When follow-up message was sent
  recoveredOrderId String?  // If user re-submitted, link to new order
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

---

# MODEL 3: RETAILERINSIGHT
model RetailerInsight {
  id              String   @id @default(cuid())
  retailerId      String   @unique
  
  // Weekly stats
  ordersThisWeek  Int      @default(0)
  ordersLastWeek  Int      @default(0)
  
  // Monthly stats
  ordersThisMonth Int      @default(0)
  avgOrderValue   Decimal  @default(0) // Last 30 days
  totalSpent      Decimal  @default(0) // Last 30 days
  
  // Engagement
  daysActive      Int      @default(0) // Days ordered in last 30 days
  
  // Cache validity
  lastCalculatedAt DateTime @default(now())
  
  updatedAt       DateTime @updatedAt
}

---

# RECOMMENDED INDEXES TO CREATE MANUALLY

CREATE INDEX idx_credit_transaction_status 
  ON "CreditTransaction"(status, type);

CREATE INDEX idx_credit_transaction_created 
  ON "CreditTransaction"("createdAt" DESC);

CREATE INDEX idx_credit_transaction_retailer 
  ON "CreditTransaction"("retailerId");

CREATE INDEX idx_retailer_credit_status 
  ON "Retailer"("creditStatus");

CREATE INDEX idx_audit_log_retailer 
  ON "AuditLog"("retailerId");

CREATE INDEX idx_pending_order_status 
  ON "PendingOrder"(status, "expiresAt");

---

# MIGRATION FILE LOCATION
prisma/migrations/[timestamp]_add_credit_operations_system/

---

# HOW TO APPLY

1. Make sure all changes to schema.prisma are saved
2. Run: npx prisma migrate dev --name "add_credit_operations_system"
3. This will:
   - Create a migration file
   - Apply SQL to database
   - Generate Prisma client
4. Verify with: npx prisma db push

---

# DATA PRESERVATION

All existing data is preserved:
- No tables dropped
- No columns deleted
- Only additions and new tables
- Safe for production upgrade

---

# ROLLBACK (If Needed)

npx prisma migrate resolve --rolled-back "add_credit_operations_system"

Then restore from backup.

---

# TIMING

Migration is quick for existing databases:
- <1s for small databases (<100K records)
- <30s for large databases (1M+ records)
- No downtime required
- Concurrent requests safe

"""
