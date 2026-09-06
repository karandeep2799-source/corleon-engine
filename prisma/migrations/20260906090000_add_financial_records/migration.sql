CREATE TYPE "FinancialRecordType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'FEE', 'REFUND', 'CHARGEBACK', 'ADJUSTMENT');
CREATE TYPE "FinancialRecordStatus" AS ENUM ('PENDING', 'POSTED', 'VOIDED');

CREATE TABLE "FinancialRecord" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "externalId" TEXT,
  "provider" TEXT,
  "type" "FinancialRecordType" NOT NULL,
  "status" "FinancialRecordStatus" NOT NULL DEFAULT 'POSTED',
  "amount" DECIMAL(20,8) NOT NULL,
  "currency" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "source" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceSnapshot" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "asOf" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL,
  "income" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "expenses" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "fees" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "refunds" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "chargebacks" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "transfers" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "adjustments" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "net" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "availableAffiliateBalance" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "pendingAffiliateBalance" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "paidAffiliateBalance" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "recordCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinanceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialRecord_idempotencyKey_key" ON "FinancialRecord"("idempotencyKey");
CREATE INDEX "FinancialRecord_organizationId_occurredAt_idx" ON "FinancialRecord"("organizationId", "occurredAt");
CREATE INDEX "FinancialRecord_organizationId_type_status_idx" ON "FinancialRecord"("organizationId", "type", "status");
CREATE INDEX "FinancialRecord_provider_externalId_idx" ON "FinancialRecord"("provider", "externalId");
CREATE UNIQUE INDEX "FinanceSnapshot_organizationId_asOf_currency_key" ON "FinanceSnapshot"("organizationId", "asOf", "currency");
CREATE INDEX "FinanceSnapshot_organizationId_asOf_idx" ON "FinanceSnapshot"("organizationId", "asOf");

ALTER TABLE "FinancialRecord" ADD CONSTRAINT "FinancialRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceSnapshot" ADD CONSTRAINT "FinanceSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
