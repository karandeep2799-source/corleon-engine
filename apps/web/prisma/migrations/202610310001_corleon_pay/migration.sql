CREATE TYPE "PaymentProvider" AS ENUM ('RAZORPAY');
CREATE TYPE "PaymentStatus" AS ENUM ('PROCESSING', 'CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED');

CREATE TABLE "PaymentQuote" (
  "id" UUID NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
  "description" VARCHAR(120) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentQuote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PaymentQuote_userId_expiresAt_idx" ON "PaymentQuote"("userId", "expiresAt");

CREATE TABLE "Payment" (
  "id" UUID NOT NULL,
  "userId" TEXT NOT NULL,
  "quoteId" UUID NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "providerOrderId" TEXT,
  "providerPaymentId" TEXT,
  "amount" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
  "idempotencyKey" TEXT NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
  "description" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "capturedAt" TIMESTAMP(3),
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "PaymentQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Payment_quoteId_key" ON "Payment"("quoteId");
CREATE UNIQUE INDEX "Payment_providerOrderId_key" ON "Payment"("providerOrderId");
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt" DESC);
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

CREATE TABLE "PaymentWebhookEvent" (
  "id" UUID NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentWebhookEvent_providerEventId_key" ON "PaymentWebhookEvent"("providerEventId");
CREATE INDEX "PaymentWebhookEvent_receivedAt_idx" ON "PaymentWebhookEvent"("receivedAt");
