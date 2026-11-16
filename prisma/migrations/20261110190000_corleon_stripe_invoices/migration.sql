-- Corleon Stripe invoice persistence
ALTER TABLE "Customer" ADD COLUMN "stripeCustomerId" TEXT;

CREATE TYPE "StripeInvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

CREATE TABLE "StripeInvoice" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "stripeInvoiceId" TEXT NOT NULL,
  "number" TEXT,
  "status" "StripeInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'inr',
  "subtotal" BIGINT NOT NULL DEFAULT 0,
  "total" BIGINT NOT NULL DEFAULT 0,
  "amountDue" BIGINT NOT NULL DEFAULT 0,
  "amountPaid" BIGINT NOT NULL DEFAULT 0,
  "hostedInvoiceUrl" TEXT,
  "invoicePdf" TEXT,
  "dueDate" TIMESTAMP(3),
  "finalizedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StripeInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StripeWebhookReceipt" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "livemode" BOOLEAN NOT NULL DEFAULT false,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StripeWebhookReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StripeInvoice_stripeInvoiceId_key" ON "StripeInvoice"("stripeInvoiceId");
CREATE UNIQUE INDEX "StripeInvoice_organizationId_number_key" ON "StripeInvoice"("organizationId", "number");
CREATE INDEX "StripeInvoice_organizationId_status_createdAt_idx" ON "StripeInvoice"("organizationId", "status", "createdAt");
CREATE INDEX "StripeInvoice_customerId_createdAt_idx" ON "StripeInvoice"("customerId", "createdAt");
CREATE UNIQUE INDEX "StripeWebhookReceipt_eventId_key" ON "StripeWebhookReceipt"("eventId");
CREATE INDEX "StripeWebhookReceipt_eventType_createdAt_idx" ON "StripeWebhookReceipt"("eventType", "createdAt");

ALTER TABLE "StripeInvoice" ADD CONSTRAINT "StripeInvoice_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StripeInvoice" ADD CONSTRAINT "StripeInvoice_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
