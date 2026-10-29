CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED', 'TOKEN_RECEIVED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

CREATE TABLE "PaymentAttempt" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "orderReference" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
  "provider" TEXT NOT NULL DEFAULT 'google_pay',
  "providerReference" TEXT,
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentAttemptEvent" (
  "id" TEXT NOT NULL,
  "paymentAttemptId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'google_pay',
  "requestId" TEXT,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAttemptEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentAttempt_organizationId_idempotencyKey_key" ON "PaymentAttempt"("organizationId", "idempotencyKey");
CREATE INDEX "PaymentAttempt_organizationId_createdAt_idx" ON "PaymentAttempt"("organizationId", "createdAt");
CREATE INDEX "PaymentAttempt_orderReference_idx" ON "PaymentAttempt"("orderReference");
CREATE INDEX "PaymentAttempt_status_updatedAt_idx" ON "PaymentAttempt"("status", "updatedAt");
CREATE INDEX "PaymentAttemptEvent_paymentAttemptId_createdAt_idx" ON "PaymentAttemptEvent"("paymentAttemptId", "createdAt");
CREATE INDEX "PaymentAttemptEvent_eventType_createdAt_idx" ON "PaymentAttemptEvent"("eventType", "createdAt");

ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAttemptEvent" ADD CONSTRAINT "PaymentAttemptEvent_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentAttempt" ALTER COLUMN "provider" SET DEFAULT 'razorpay';
ALTER TABLE "PaymentAttempt" ADD COLUMN "razorpayOrderId" TEXT;
ALTER TABLE "PaymentAttempt" ADD COLUMN "razorpayPaymentId" TEXT;
CREATE UNIQUE INDEX "PaymentAttempt_razorpayOrderId_key" ON "PaymentAttempt"("razorpayOrderId");
CREATE UNIQUE INDEX "PaymentAttempt_razorpayPaymentId_key" ON "PaymentAttempt"("razorpayPaymentId");

CREATE TABLE "RazorpayWebhookEvent" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "organizationId" TEXT,
  "payload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "RazorpayWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RazorpayWebhookEvent_eventId_key" ON "RazorpayWebhookEvent"("eventId");
CREATE INDEX "RazorpayWebhookEvent_eventType_receivedAt_idx" ON "RazorpayWebhookEvent"("eventType", "receivedAt");
CREATE INDEX "RazorpayWebhookEvent_processedAt_receivedAt_idx" ON "RazorpayWebhookEvent"("processedAt", "receivedAt");
ALTER TABLE "RazorpayWebhookEvent" ADD CONSTRAINT "RazorpayWebhookEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
