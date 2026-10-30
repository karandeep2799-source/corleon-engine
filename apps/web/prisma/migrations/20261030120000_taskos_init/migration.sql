CREATE TYPE "TaskStatus" AS ENUM ('INBOX','TODO','IN_PROGRESS','BLOCKED','DONE','CANCELLED');
CREATE TYPE "TaskPriority" AS ENUM ('LOW','NORMAL','HIGH','URGENT');
CREATE TYPE "TaskSource" AS ENUM ('CORLEON','GOOGLE_TASKS');
CREATE TYPE "TaskJobStatus" AS ENUM ('PENDING','RUNNING','SUCCEEDED','FAILED','DEAD');
CREATE TYPE "TaskAgentRunStatus" AS ENUM ('QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELLED');
CREATE TYPE "BillingStatus" AS ENUM ('INCOMPLETE','TRIALING','ACTIVE','PAST_DUE','CANCELED','UNPAID');

CREATE TABLE "TaskUser" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "email" TEXT, "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskUser_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TaskUser_tenantId_id_key" ON "TaskUser"("tenantId","id");
CREATE INDEX "TaskUser_tenantId_idx" ON "TaskUser"("tenantId");

CREATE TABLE "Task" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "ownerId" TEXT NOT NULL, "title" TEXT NOT NULL, "notes" TEXT,
  "status" "TaskStatus" NOT NULL DEFAULT 'INBOX', "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
  "source" "TaskSource" NOT NULL DEFAULT 'CORLEON', "externalId" TEXT, "externalListId" TEXT,
  "dueAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "position" INTEGER NOT NULL DEFAULT 0,
  "labels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "metadata" JSONB, "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Task_tenantId_ownerId_fkey" FOREIGN KEY ("tenantId","ownerId") REFERENCES "TaskUser"("tenantId","id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Task_tenantId_source_externalId_key" ON "Task"("tenantId","source","externalId");
CREATE INDEX "Task_tenantId_ownerId_status_dueAt_idx" ON "Task"("tenantId","ownerId","status","dueAt");
CREATE INDEX "Task_tenantId_updatedAt_idx" ON "Task"("tenantId","updatedAt");

CREATE TABLE "GoogleTasksConnection" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "userId" TEXT NOT NULL, "googleAccountEmail" TEXT,
  "encryptedAccess" TEXT NOT NULL, "encryptedRefresh" TEXT NOT NULL, "accessExpiresAt" TIMESTAMP(3) NOT NULL,
  "scope" TEXT NOT NULL, "syncToken" TEXT, "lastSyncAt" TIMESTAMP(3), "lastError" TEXT,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GoogleTasksConnection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GoogleTasksConnection_tenantId_userId_fkey" FOREIGN KEY ("tenantId","userId") REFERENCES "TaskUser"("tenantId","id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GoogleTasksConnection_userId_key" ON "GoogleTasksConnection"("userId");
CREATE INDEX "GoogleTasksConnection_tenantId_idx" ON "GoogleTasksConnection"("tenantId");

CREATE TABLE "TaskJob" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "kind" TEXT NOT NULL, "payload" JSONB NOT NULL,
  "status" "TaskJobStatus" NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 8, "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3), "lockedBy" TEXT, "lastError" TEXT, "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TaskJob_idempotencyKey_key" ON "TaskJob"("idempotencyKey");
CREATE INDEX "TaskJob_status_runAt_idx" ON "TaskJob"("status","runAt");
CREATE INDEX "TaskJob_tenantId_createdAt_idx" ON "TaskJob"("tenantId","createdAt");

CREATE TABLE "TaskAgentRun" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "userId" TEXT NOT NULL, "agent" TEXT NOT NULL,
  "status" "TaskAgentRunStatus" NOT NULL DEFAULT 'QUEUED', "input" JSONB NOT NULL, "output" JSONB,
  "error" TEXT, "startedAt" TIMESTAMP(3), "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TaskAgentRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskAgentRun_tenantId_userId_fkey" FOREIGN KEY ("tenantId","userId") REFERENCES "TaskUser"("tenantId","id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TaskAgentRun_tenantId_userId_createdAt_idx" ON "TaskAgentRun"("tenantId","userId","createdAt");

CREATE TABLE "TaskAuditEvent" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "actorId" TEXT, "action" TEXT NOT NULL, "resource" TEXT NOT NULL,
  "resourceId" TEXT, "metadata" JSONB, "requestId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskAuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TaskAuditEvent_tenantId_createdAt_idx" ON "TaskAuditEvent"("tenantId","createdAt");

CREATE TABLE "StripeCustomer" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "stripeCustomerId" TEXT NOT NULL, "email" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StripeCustomer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StripeCustomer_tenantId_key" ON "StripeCustomer"("tenantId");
CREATE UNIQUE INDEX "StripeCustomer_stripeCustomerId_key" ON "StripeCustomer"("stripeCustomerId");

CREATE TABLE "StripeSubscription" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "customerId" TEXT NOT NULL, "stripeSubscriptionId" TEXT NOT NULL,
  "stripePriceId" TEXT NOT NULL, "status" "BillingStatus" NOT NULL, "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false, "updatedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StripeSubscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StripeSubscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "StripeCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StripeSubscription_tenantId_key" ON "StripeSubscription"("tenantId");
CREATE UNIQUE INDEX "StripeSubscription_customerId_key" ON "StripeSubscription"("customerId");
CREATE UNIQUE INDEX "StripeSubscription_stripeSubscriptionId_key" ON "StripeSubscription"("stripeSubscriptionId");

CREATE TABLE "StripeWebhookEvent" (
  "id" TEXT NOT NULL, "stripeEventId" TEXT NOT NULL, "type" TEXT NOT NULL, "processedAt" TIMESTAMP(3),
  "payload" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StripeWebhookEvent_stripeEventId_key" ON "StripeWebhookEvent"("stripeEventId");
