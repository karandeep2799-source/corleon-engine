CREATE TABLE "CreativeBillingAccount" ("id" TEXT NOT NULL,"tenantId" TEXT NOT NULL,"stripeCustomerId" TEXT NOT NULL,"stripeSubscriptionId" TEXT,"stripePriceId" TEXT,"status" TEXT NOT NULL DEFAULT 'incomplete',"currentPeriodEnd" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "CreativeBillingAccount_pkey" PRIMARY KEY ("id"));
CREATE TABLE "CreativeStripeEvent" ("id" TEXT NOT NULL,"tenantId" TEXT,"type" TEXT NOT NULL,"processedAt" TIMESTAMP(3),"receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"payload" JSONB NOT NULL,CONSTRAINT "CreativeStripeEvent_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "CreativeBillingAccount_tenantId_key" ON "CreativeBillingAccount"("tenantId");
CREATE UNIQUE INDEX "CreativeBillingAccount_stripeCustomerId_key" ON "CreativeBillingAccount"("stripeCustomerId");
CREATE UNIQUE INDEX "CreativeBillingAccount_stripeSubscriptionId_key" ON "CreativeBillingAccount"("stripeSubscriptionId");
CREATE INDEX "CreativeStripeEvent_tenantId_receivedAt_idx" ON "CreativeStripeEvent"("tenantId","receivedAt");
CREATE INDEX "CreativeStripeEvent_type_receivedAt_idx" ON "CreativeStripeEvent"("type","receivedAt");
ALTER TABLE "CreativeBillingAccount" ADD CONSTRAINT "CreativeBillingAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "CreativeTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeStripeEvent" ADD CONSTRAINT "CreativeStripeEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "CreativeTenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
