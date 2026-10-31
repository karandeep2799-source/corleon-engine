CREATE TABLE "WorldBankDataset" (
  "id" TEXT NOT NULL,
  "uniqueId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "version" TEXT,
  "sourceUrl" TEXT,
  "metadata" JSONB NOT NULL,
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorldBankDataset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldBankDatasetVersion" (
  "id" TEXT NOT NULL,
  "datasetId" TEXT NOT NULL,
  "sourceVersionId" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorldBankDatasetVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldBankResource" (
  "id" TEXT NOT NULL,
  "uniqueId" TEXT NOT NULL,
  "datasetId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "fileFormat" TEXT,
  "downloadUrl" TEXT,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorldBankResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldBankIndicator" (
  "id" TEXT NOT NULL,
  "uniqueId" TEXT NOT NULL,
  "datasetId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorldBankIndicator_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldBankCitation" (
  "id" TEXT NOT NULL,
  "uniqueId" TEXT NOT NULL,
  "datasetId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT,
  "year" TEXT,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorldBankCitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldBankSyncJob" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "recordsSeen" INTEGER NOT NULL DEFAULT 0,
  "recordsUpserted" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorldBankSyncJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldBankSyncLog" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'INFO',
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorldBankSyncLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorldBankDataset_uniqueId_key" ON "WorldBankDataset"("uniqueId");
CREATE INDEX "WorldBankDataset_title_idx" ON "WorldBankDataset"("title");
CREATE INDEX "WorldBankDataset_syncedAt_idx" ON "WorldBankDataset"("syncedAt");
CREATE UNIQUE INDEX "WorldBankDatasetVersion_datasetId_sourceVersionId_key" ON "WorldBankDatasetVersion"("datasetId", "sourceVersionId");
CREATE INDEX "WorldBankDatasetVersion_datasetId_capturedAt_idx" ON "WorldBankDatasetVersion"("datasetId", "capturedAt");
CREATE UNIQUE INDEX "WorldBankResource_uniqueId_key" ON "WorldBankResource"("uniqueId");
CREATE INDEX "WorldBankResource_datasetId_idx" ON "WorldBankResource"("datasetId");
CREATE UNIQUE INDEX "WorldBankIndicator_uniqueId_key" ON "WorldBankIndicator"("uniqueId");
CREATE INDEX "WorldBankIndicator_datasetId_idx" ON "WorldBankIndicator"("datasetId");
CREATE INDEX "WorldBankIndicator_name_idx" ON "WorldBankIndicator"("name");
CREATE UNIQUE INDEX "WorldBankCitation_uniqueId_key" ON "WorldBankCitation"("uniqueId");
CREATE INDEX "WorldBankCitation_datasetId_idx" ON "WorldBankCitation"("datasetId");
CREATE INDEX "WorldBankSyncJob_status_createdAt_idx" ON "WorldBankSyncJob"("status", "createdAt");
CREATE INDEX "WorldBankSyncLog_jobId_createdAt_idx" ON "WorldBankSyncLog"("jobId", "createdAt");

ALTER TABLE "WorldBankDatasetVersion"
  ADD CONSTRAINT "WorldBankDatasetVersion_datasetId_fkey"
  FOREIGN KEY ("datasetId") REFERENCES "WorldBankDataset"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldBankResource"
  ADD CONSTRAINT "WorldBankResource_datasetId_fkey"
  FOREIGN KEY ("datasetId") REFERENCES "WorldBankDataset"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldBankIndicator"
  ADD CONSTRAINT "WorldBankIndicator_datasetId_fkey"
  FOREIGN KEY ("datasetId") REFERENCES "WorldBankDataset"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldBankCitation"
  ADD CONSTRAINT "WorldBankCitation_datasetId_fkey"
  FOREIGN KEY ("datasetId") REFERENCES "WorldBankDataset"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldBankSyncLog"
  ADD CONSTRAINT "WorldBankSyncLog_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "WorldBankSyncJob"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
