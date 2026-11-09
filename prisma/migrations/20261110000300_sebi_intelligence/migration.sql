CREATE TYPE "SebiDocumentStatus" AS ENUM ('DISCOVERED', 'REVIEWED', 'ARCHIVED');

CREATE TABLE "SebiDocument" (
  "id" TEXT NOT NULL,
  "canonicalUrl" TEXT NOT NULL,
  "title" VARCHAR(500) NOT NULL,
  "description" TEXT,
  "content" TEXT,
  "category" VARCHAR(80) NOT NULL DEFAULT 'Other',
  "publishedAt" TIMESTAMP(3),
  "sourceUrl" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL DEFAULT 'SEBI',
  "contentHash" TEXT,
  "status" "SebiDocumentStatus" NOT NULL DEFAULT 'DISCOVERED',
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SebiDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SebiIngestionRun" (
  "id" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "discovered" INTEGER NOT NULL DEFAULT 0,
  "inserted" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "SebiIngestionRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SebiDocument_canonicalUrl_key" ON "SebiDocument"("canonicalUrl");
CREATE INDEX "SebiDocument_category_publishedAt_idx" ON "SebiDocument"("category", "publishedAt");
CREATE INDEX "SebiDocument_status_publishedAt_idx" ON "SebiDocument"("status", "publishedAt");
CREATE INDEX "SebiDocument_contentHash_idx" ON "SebiDocument"("contentHash");
CREATE INDEX "SebiIngestionRun_startedAt_idx" ON "SebiIngestionRun"("startedAt");
