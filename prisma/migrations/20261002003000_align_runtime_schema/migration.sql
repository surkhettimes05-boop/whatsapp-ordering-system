-- Close historical schema drift that existed outside the Prisma migration chain.
-- This migration is additive so it is safe for fresh databases and existing deployments.

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "deliveryOTP" TEXT,
  ADD COLUMN IF NOT EXISTS "otpVerified" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "order_images" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "order_images_orderId_idx" ON "order_images"("orderId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_images_orderId_fkey'
  ) THEN
    ALTER TABLE "order_images"
      ADD CONSTRAINT "order_images_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "orders"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "launch_control_settings" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL DEFAULT 'system',
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "launch_control_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "launch_control_settings_key_key"
  ON "launch_control_settings"("key");
CREATE INDEX IF NOT EXISTS "launch_control_settings_key_idx"
  ON "launch_control_settings"("key");
CREATE INDEX IF NOT EXISTS "launch_control_settings_category_idx"
  ON "launch_control_settings"("category");
CREATE INDEX IF NOT EXISTS "launch_control_settings_isActive_idx"
  ON "launch_control_settings"("isActive");

CREATE TABLE IF NOT EXISTS "launch_control_audit" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "oldValue" TEXT,
  "newValue" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "reason" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "launch_control_audit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "launch_control_audit_key_idx"
  ON "launch_control_audit"("key");
CREATE INDEX IF NOT EXISTS "launch_control_audit_changedBy_idx"
  ON "launch_control_audit"("changedBy");
CREATE INDEX IF NOT EXISTS "launch_control_audit_timestamp_idx"
  ON "launch_control_audit"("timestamp");

CREATE TABLE IF NOT EXISTS "system_metrics" (
  "id" TEXT NOT NULL,
  "metricName" TEXT NOT NULL,
  "metricValue" DECIMAL(65,30) NOT NULL,
  "metricType" TEXT NOT NULL,
  "tags" TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_metrics_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "system_metrics_metricName_timestamp_idx"
  ON "system_metrics"("metricName", "timestamp");

CREATE TABLE IF NOT EXISTS "launch_control_alerts" (
  "id" TEXT NOT NULL,
  "alertType" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "details" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "acknowledgedBy" TEXT,
  "acknowledgedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "launch_control_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "launch_control_alerts_alertType_status_createdAt_idx"
  ON "launch_control_alerts"("alertType", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "launch_control_alerts_severity_idx"
  ON "launch_control_alerts"("severity");
CREATE INDEX IF NOT EXISTS "launch_control_alerts_status_idx"
  ON "launch_control_alerts"("status");
