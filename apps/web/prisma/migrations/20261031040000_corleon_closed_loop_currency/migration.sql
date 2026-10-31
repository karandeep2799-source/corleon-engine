CREATE TYPE "CurrencyWalletStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE "CurrencyLedgerType" AS ENUM ('ISSUE', 'REDEEM', 'REVERSAL', 'EXPIRY', 'ADJUSTMENT');

CREATE TABLE "CurrencyStore" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CurrencyStore_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CurrencyWallet" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "customerEmail" TEXT NOT NULL,
  "customerName" TEXT,
  "status" "CurrencyWalletStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CurrencyWallet_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CurrencyLedgerEntry" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "storeId" TEXT,
  "type" "CurrencyLedgerType" NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "orderReference" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CurrencyLedgerEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CurrencyLedgerEntry_amount_nonzero" CHECK ("amount" <> 0)
);
CREATE UNIQUE INDEX "CurrencyStore_ownerUserId_slug_key" ON "CurrencyStore"("ownerUserId", "slug");
CREATE INDEX "CurrencyStore_ownerUserId_status_idx" ON "CurrencyStore"("ownerUserId", "status");
CREATE UNIQUE INDEX "CurrencyWallet_ownerUserId_customerEmail_key" ON "CurrencyWallet"("ownerUserId", "customerEmail");
CREATE INDEX "CurrencyWallet_ownerUserId_status_idx" ON "CurrencyWallet"("ownerUserId", "status");
CREATE UNIQUE INDEX "CurrencyLedgerEntry_idempotencyKey_key" ON "CurrencyLedgerEntry"("idempotencyKey");
CREATE INDEX "CurrencyLedgerEntry_ownerUserId_createdAt_idx" ON "CurrencyLedgerEntry"("ownerUserId", "createdAt");
CREATE INDEX "CurrencyLedgerEntry_walletId_createdAt_idx" ON "CurrencyLedgerEntry"("walletId", "createdAt");
CREATE INDEX "CurrencyLedgerEntry_storeId_createdAt_idx" ON "CurrencyLedgerEntry"("storeId", "createdAt");
CREATE INDEX "CurrencyLedgerEntry_type_createdAt_idx" ON "CurrencyLedgerEntry"("type", "createdAt");
ALTER TABLE "CurrencyStore" ADD CONSTRAINT "CurrencyStore_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CurrencyWallet" ADD CONSTRAINT "CurrencyWallet_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CurrencyLedgerEntry" ADD CONSTRAINT "CurrencyLedgerEntry_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "CurrencyWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurrencyLedgerEntry" ADD CONSTRAINT "CurrencyLedgerEntry_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "CurrencyStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enforce append-only ledger semantics at the database boundary.
CREATE FUNCTION "reject_currency_ledger_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Corleon currency ledger entries are immutable; create a compensating entry';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "CurrencyLedgerEntry_immutable"
  BEFORE UPDATE OR DELETE ON "CurrencyLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION "reject_currency_ledger_mutation"();
