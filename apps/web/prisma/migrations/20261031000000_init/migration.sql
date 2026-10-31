CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "image" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TradingAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TradingAccount_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BrokerConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "externalUserId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "secretRef" TEXT,
  "connectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrokerConnection_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Order" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "brokerConnectionId" TEXT,
  "provider" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "side" TEXT NOT NULL,
  "orderType" TEXT NOT NULL,
  "timeInForce" TEXT NOT NULL DEFAULT 'DAY',
  "quantity" DECIMAL(28,10) NOT NULL,
  "limitPrice" DECIMAL(28,10),
  "stopPrice" DECIMAL(28,10),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "externalOrderId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "rejectionReason" TEXT,
  "submittedAt" TIMESTAMP(3),
  "filledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Position" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "quantity" DECIMAL(28,10) NOT NULL,
  "averagePrice" DECIMAL(28,10) NOT NULL,
  "currency" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RiskLimit" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "maxOrderNotional" DECIMAL(28,10),
  "maxDailyNotional" DECIMAL(28,10),
  "maxOpenOrders" INTEGER NOT NULL DEFAULT 10,
  "tradingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "requireLimitOrders" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RiskLimit_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "actorType" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "resourceId" TEXT,
  "outcome" TEXT NOT NULL,
  "metadata" JSONB,
  "ipHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "IdempotencyRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "response" JSONB,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");
CREATE INDEX "TradingAccount_userId_status_idx" ON "TradingAccount"("userId","status");
CREATE UNIQUE INDEX "BrokerConnection_userId_provider_market_key" ON "BrokerConnection"("userId","provider","market");
CREATE INDEX "BrokerConnection_status_market_idx" ON "BrokerConnection"("status","market");
CREATE UNIQUE INDEX "Order_userId_idempotencyKey_key" ON "Order"("userId","idempotencyKey");
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId","createdAt");
CREATE INDEX "Order_accountId_status_idx" ON "Order"("accountId","status");
CREATE INDEX "Order_provider_externalOrderId_idx" ON "Order"("provider","externalOrderId");
CREATE UNIQUE INDEX "Position_accountId_market_symbol_key" ON "Position"("accountId","market","symbol");
CREATE INDEX "Position_userId_market_idx" ON "Position"("userId","market");
CREATE UNIQUE INDEX "RiskLimit_userId_market_key" ON "RiskLimit"("userId","market");
CREATE INDEX "AuditEvent_userId_createdAt_idx" ON "AuditEvent"("userId","createdAt");
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action","createdAt");
CREATE UNIQUE INDEX "IdempotencyRecord_userId_key_key" ON "IdempotencyRecord"("userId","key");
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");
ALTER TABLE "TradingAccount" ADD CONSTRAINT "TradingAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrokerConnection" ADD CONSTRAINT "BrokerConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Position" ADD CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Position" ADD CONSTRAINT "Position_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskLimit" ADD CONSTRAINT "RiskLimit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
