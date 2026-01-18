/**
 * PRISMA SCHEMA ADDITIONS FOR ORDER STATE MACHINE
 * 
 * Add these models to your prisma/schema.prisma file
 * Then run: npx prisma migrate dev --name "add_order_state_machine"
 */

// MODEL TO ADD TO SCHEMA.PRISMA:

/*
// ============================================
// ORDER STATE MACHINE MODELS
// ============================================

// Transition history for audit trail
model OrderTransitionLog {
  id        String   @id @default(cuid())
  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderId   String
  
  fromState String   // Previous state
  toState   String   // New state
  reason    String?  // Why the transition happened
  userId    String   // Who initiated the transition
  metadata  String?  // JSON metadata
  
  timestamp DateTime @default(now())
  
  @@index([orderId])
  @@index([timestamp])
}

// Add to Order model:
// transitionHistory OrderTransitionLog[]
*/

// MIGRATION FILE CONTENT (after running prisma migrate):
// This is what prisma will generate based on schema changes

/*
-- CreateTable "OrderTransitionLog"
CREATE TABLE "OrderTransitionLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromState" TEXT NOT NULL,
    "toState" TEXT NOT NULL,
    "reason" TEXT,
    "userId" TEXT NOT NULL,
    "metadata" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderTransitionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderTransitionLog_orderId_idx" ON "OrderTransitionLog"("orderId");

-- CreateIndex
CREATE INDEX "OrderTransitionLog_timestamp_idx" ON "OrderTransitionLog"("timestamp");

-- AddForeignKey
ALTER TABLE "OrderTransitionLog" ADD CONSTRAINT "OrderTransitionLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
*/
