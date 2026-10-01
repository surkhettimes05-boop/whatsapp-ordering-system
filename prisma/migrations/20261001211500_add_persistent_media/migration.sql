CREATE TABLE "media_files" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "uploadedBy" TEXT,
  "storageKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "media_files_storageKey_key" ON "media_files"("storageKey");
CREATE INDEX "media_files_entityType_entityId_idx" ON "media_files"("entityType", "entityId");
CREATE INDEX "media_files_uploadedBy_idx" ON "media_files"("uploadedBy");
CREATE INDEX "media_files_createdAt_idx" ON "media_files"("createdAt");
