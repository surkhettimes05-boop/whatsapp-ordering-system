-- Bring the WhatsApp message table in line with the Prisma model used by
-- the Meta/Twilio commerce transport. Older databases were created before
-- media URLs were persisted.
ALTER TABLE "whatsapp_messages"
ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT;
