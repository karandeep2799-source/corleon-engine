CREATE TYPE "StockTransactionType" AS ENUM ('BUY', 'SELL', 'DIVIDEND', 'BONUS', 'SPLIT');
CREATE TYPE "StockReviewStatus" AS ENUM ('NEEDS_REVIEW', 'CONFIRMED', 'IGNORED');

CREATE TABLE "GmailConnection" (
  "id" TEXT NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "displayName" VARCHAR(120),
  "picture" VARCHAR(500),
  "refreshTokenEncrypted" TEXT NOT NULL,
  "grantedScopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GmailConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GmailConnection_email_key" ON "GmailConnection"("email");
CREATE INDEX "GmailConnection_connectedAt_idx" ON "GmailConnection"("connectedAt");

CREATE TABLE "StockSyncState" (
  "id" TEXT NOT NULL,
  "ownerEmail" VARCHAR(320) NOT NULL,
  "lastSyncStartedAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3),
  "nextPageToken" TEXT,
  "scanComplete" BOOLEAN NOT NULL DEFAULT false,
  "scannedCount" INTEGER NOT NULL DEFAULT 0,
  "candidateCount" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockSyncState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StockSyncState_ownerEmail_key" ON "StockSyncState"("ownerEmail");

CREATE TABLE "StockEmailEvidence" (
  "id" TEXT NOT NULL,
  "ownerEmail" VARCHAR(320) NOT NULL,
  "gmailMessageId" VARCHAR(200) NOT NULL,
  "threadId" VARCHAR(200),
  "subject" VARCHAR(500) NOT NULL,
  "sender" VARCHAR(320),
  "receivedAt" TIMESTAMP(3),
  "attachmentNames" JSONB,
  "hasFinancialData" BOOLEAN NOT NULL DEFAULT false,
  "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockEmailEvidence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StockEmailEvidence_ownerEmail_gmailMessageId_key" ON "StockEmailEvidence"("ownerEmail","gmailMessageId");
CREATE INDEX "StockEmailEvidence_ownerEmail_receivedAt_idx" ON "StockEmailEvidence"("ownerEmail","receivedAt");
CREATE INDEX "StockEmailEvidence_ownerEmail_hasFinancialData_idx" ON "StockEmailEvidence"("ownerEmail","hasFinancialData");

CREATE TABLE "StockTransaction" (
  "id" TEXT NOT NULL,
  "ownerEmail" VARCHAR(320) NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "broker" VARCHAR(120),
  "symbol" VARCHAR(24) NOT NULL,
  "companyName" VARCHAR(180),
  "exchange" VARCHAR(12),
  "type" "StockTransactionType" NOT NULL,
  "quantity" DECIMAL(30,10) NOT NULL,
  "price" DECIMAL(30,10) NOT NULL,
  "amount" DECIMAL(30,10),
  "currency" VARCHAR(8) NOT NULL DEFAULT 'INR',
  "executedAt" TIMESTAMP(3) NOT NULL,
  "confidence" INTEGER NOT NULL DEFAULT 0,
  "reviewStatus" "StockReviewStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
  "evidenceExcerpt" TEXT NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockTransaction_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "StockEmailEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StockTransaction_ownerEmail_fingerprint_key" ON "StockTransaction"("ownerEmail","fingerprint");
CREATE INDEX "StockTransaction_ownerEmail_reviewStatus_executedAt_idx" ON "StockTransaction"("ownerEmail","reviewStatus","executedAt");
CREATE INDEX "StockTransaction_ownerEmail_symbol_executedAt_idx" ON "StockTransaction"("ownerEmail","symbol","executedAt");
