/**
 * Prisma Schema Addition - WhatsApp Message Delivery Tracking
 * 
 * Add these models to your existing prisma/schema.prisma file
 * 
 * Run: npx prisma migrate dev --name add_whatsapp_delivery_tracking
 */

// Enhanced WhatsApp Message model
model WhatsAppMessage {
  id              String    @id @default(cuid())
  
  // Message identification
  messageSid      String    @unique @index // Twilio Message SID
  from            String    @index          // Sender (system or user)
  to              String    @index          // Recipient phone number
  body            String    @db.Text        // Message content
  
  // Direction and status
  direction       String    // INCOMING, OUTGOING
  status          String    @default("queued") @index
  // Status values: queued, accepted, sending, sent, delivered, read, failed, undelivered
  
  // Delivery tracking
  trackReceipts   Boolean   @default(true)
  trackReads      Boolean   @default(false)
  
  // Timestamps for delivery states
  sentAt          DateTime?
  deliveredAt     DateTime? @index
  readAt          DateTime? @index
  failedAt        DateTime? @index
  lastStatusAt    DateTime  @updatedAt @index
  
  // Error tracking
  errorCode       String?
  errorMessage    String?
  
  // Retry tracking
  retryCount      Int       @default(0)
  originalMessageSid String? // Reference to original message for retries
  
  // Metadata
  metadata        Json?     // Additional data (order ID, etc.)
  
  // Relationships
  statusLogs      MessageStatusLog[]
  
  createdAt       DateTime  @default(now()) @index
  
  @@index([messageSid, status])
  @@index([to, createdAt])
  @@index([status, createdAt])
}

// Message status transition log
model MessageStatusLog {
  id              String    @id @default(cuid())
  
  // Reference to message
  messageSid      String    @index
  message         WhatsAppMessage @relation(fields: [messageSid], references: [messageSid], onDelete: Cascade)
  
  // Status transition
  previousStatus  String
  newStatus       String
  
  // Error information
  errorCode       String?
  errorMessage    String?
  
  // Timestamp
  statusChangedAt DateTime  @default(now()) @index
  
  // Metadata
  metadata        Json?     // Any additional status info
  
  @@index([messageSid, statusChangedAt])
  @@index([newStatus, statusChangedAt])
  @@index([statusChangedAt])
}

// Message delivery metrics (for analytics)
model MessageDeliveryMetrics {
  id              String    @id @default(cuid())
  
  // Time period
  date            DateTime  @index
  hour            Int?      // Optional: for hourly metrics
  
  // Metrics
  totalSent       Int       @default(0)
  delivered       Int       @default(0)
  read            Int       @default(0)
  failed          Int       @default(0)
  pending         Int       @default(0)
  
  // Rates
  deliveryRate    Float     @default(0)
  readRate        Float     @default(0)
  failureRate     Float     @default(0)
  
  // Timing
  averageDeliveryTimeMs Int?
  medianDeliveryTimeMs  Int?
  
  // Error breakdown
  errorBreakdown  Json?     // { "30003": 5, "30004": 2, ... }
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([date])
  @@index([date, hour])
}

// Phone number delivery performance
model PhoneDeliveryPerformance {
  id              String    @id @default(cuid())
  
  // Phone number
  phoneNumber     String    @unique @index
  
  // Performance metrics
  totalMessages   Int       @default(0)
  successCount    Int       @default(0)
  failureCount    Int       @default(0)
  lastMessageAt   DateTime?
  
  // Average metrics
  avgDeliveryTimeMs Int?
  deliveryRate    Float     @default(0)
  
  // Recent errors
  recentErrors    Json?     // Last 5 errors
  
  // Health status
  healthStatus    String    @default("unknown") // unknown, healthy, degraded, failed
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([phoneNumber, updatedAt])
  @@index([healthStatus])
}

/**
 * Migration Script Example:
 * 
 * File: prisma/migrations/add_whatsapp_delivery_tracking.ts
 */

/*
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addDeliveryTracking() {
  console.log('Adding WhatsApp delivery tracking tables...');
  
  try {
    // Add new fields to existing WhatsAppMessage
    // (if upgrading from simpler schema)
    
    // Create status log table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "MessageStatusLog" (
        id TEXT PRIMARY KEY,
        "messageSid" TEXT NOT NULL REFERENCES "WhatsAppMessage"("messageSid") ON DELETE CASCADE,
        "previousStatus" TEXT NOT NULL,
        "newStatus" TEXT NOT NULL,
        "errorCode" TEXT,
        "errorMessage" TEXT,
        "statusChangedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB,
        FOREIGN KEY ("messageSid") REFERENCES "WhatsAppMessage"("messageSid") ON DELETE CASCADE
      );
    `;
    
    // Create indexes for performance
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "MessageStatusLog_messageSid_idx" 
      ON "MessageStatusLog"("messageSid");
      
      CREATE INDEX IF NOT EXISTS "MessageStatusLog_statusChangedAt_idx" 
      ON "MessageStatusLog"("statusChangedAt");
    `;
    
    // Create metrics tables
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "MessageDeliveryMetrics" (
        id TEXT PRIMARY KEY,
        date TIMESTAMP NOT NULL,
        hour INT,
        "totalSent" INT DEFAULT 0,
        delivered INT DEFAULT 0,
        read INT DEFAULT 0,
        failed INT DEFAULT 0,
        pending INT DEFAULT 0,
        "deliveryRate" FLOAT DEFAULT 0,
        "readRate" FLOAT DEFAULT 0,
        "failureRate" FLOAT DEFAULT 0,
        "averageDeliveryTimeMs" INT,
        "medianDeliveryTimeMs" INT,
        "errorBreakdown" JSONB,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "MessageDeliveryMetrics_date_idx" 
      ON "MessageDeliveryMetrics"(date);
    `;
    
    console.log('✅ WhatsApp delivery tracking tables created successfully');
  } catch (error) {
    console.error('❌ Error creating delivery tracking tables:', error);
    throw error;
  }
}

addDeliveryTracking()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
*/
