CREATE TYPE "PaymentStatus" AS ENUM ('PENDING','SUCCEEDED','FAILED','REFUNDED');

CREATE TABLE "StripePayment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "stripeCheckoutSessionId" TEXT NOT NULL,
  "stripePaymentIntentId" TEXT,
  "amount" INTEGER,
  "currency" TEXT,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StripePayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StripePayment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "StripeCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StripePayment_stripeCheckoutSessionId_key" ON "StripePayment"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "StripePayment_stripePaymentIntentId_key" ON "StripePayment"("stripePaymentIntentId");
CREATE INDEX "StripePayment_tenantId_createdAt_idx" ON "StripePayment"("tenantId","createdAt");
CREATE INDEX "StripePayment_tenantId_status_idx" ON "StripePayment"("tenantId","status");
