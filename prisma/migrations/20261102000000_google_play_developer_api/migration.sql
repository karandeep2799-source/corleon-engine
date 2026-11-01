CREATE TABLE "GooglePlayPurchase" (
  "id" TEXT NOT NULL, "packageName" TEXT NOT NULL, "purchaseTokenHash" TEXT NOT NULL,
  "productId" TEXT, "purchaseKind" TEXT NOT NULL, "purchaseState" TEXT NOT NULL, "orderId" TEXT,
  "subscriptionState" TEXT, "acknowledgementState" TEXT, "consumptionState" TEXT,
  "purchasedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3),
  "lastVerifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "providerData" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "GooglePlayPurchase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GooglePlayPurchase_packageName_purchaseTokenHash_key" ON "GooglePlayPurchase"("packageName", "purchaseTokenHash");
CREATE INDEX "GooglePlayPurchase_packageName_purchaseState_idx" ON "GooglePlayPurchase"("packageName", "purchaseState");
CREATE INDEX "GooglePlayPurchase_packageName_expiresAt_idx" ON "GooglePlayPurchase"("packageName", "expiresAt");
CREATE TABLE "GooglePlayNotification" (
  "id" TEXT NOT NULL, "messageId" TEXT NOT NULL, "packageName" TEXT NOT NULL, "notificationType" TEXT NOT NULL,
  "eventTime" TIMESTAMP(3), "purchaseTokenHash" TEXT, "processingStatus" TEXT NOT NULL DEFAULT 'PROCESSED',
  "errorCode" TEXT, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "processedAt" TIMESTAMP(3),
  CONSTRAINT "GooglePlayNotification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GooglePlayNotification_messageId_key" ON "GooglePlayNotification"("messageId");
CREATE INDEX "GooglePlayNotification_packageName_receivedAt_idx" ON "GooglePlayNotification"("packageName", "receivedAt");
CREATE INDEX "GooglePlayNotification_processingStatus_receivedAt_idx" ON "GooglePlayNotification"("processingStatus", "receivedAt");
CREATE TABLE "GooglePlayAuditLog" (
  "id" TEXT NOT NULL, "action" TEXT NOT NULL, "packageName" TEXT NOT NULL, "actor" TEXT,
  "resourceId" TEXT, "outcome" TEXT NOT NULL, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GooglePlayAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GooglePlayAuditLog_packageName_createdAt_idx" ON "GooglePlayAuditLog"("packageName", "createdAt");
CREATE INDEX "GooglePlayAuditLog_action_createdAt_idx" ON "GooglePlayAuditLog"("action", "createdAt");
