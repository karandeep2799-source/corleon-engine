CREATE TABLE "AssistantProfile" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "key" TEXT NOT NULL, "name" TEXT NOT NULL,
  "category" TEXT NOT NULL, "description" TEXT NOT NULL, "readiness" TEXT NOT NULL DEFAULT 'ready',
  "outputMode" TEXT NOT NULL DEFAULT 'text', "enabled" BOOLEAN NOT NULL DEFAULT true,
  "model" TEXT NOT NULL, "systemPrompt" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AssistantProfile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AssistantRun" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "assistantProfileId" TEXT NOT NULL, "assistantKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING', "provider" TEXT NOT NULL, "model" TEXT NOT NULL, "input" JSONB NOT NULL,
  "output" TEXT, "errorMessage" TEXT, "providerResponseId" TEXT, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssistantProfile_organizationId_key_key" ON "AssistantProfile"("organizationId", "key");
CREATE INDEX "AssistantProfile_organizationId_enabled_idx" ON "AssistantProfile"("organizationId", "enabled");
CREATE INDEX "AssistantRun_organizationId_createdAt_idx" ON "AssistantRun"("organizationId", "createdAt");
CREATE INDEX "AssistantRun_assistantProfileId_createdAt_idx" ON "AssistantRun"("assistantProfileId", "createdAt");
CREATE INDEX "AssistantRun_status_createdAt_idx" ON "AssistantRun"("status", "createdAt");
ALTER TABLE "AssistantProfile" ADD CONSTRAINT "AssistantProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantRun" ADD CONSTRAINT "AssistantRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantRun" ADD CONSTRAINT "AssistantRun_assistantProfileId_fkey" FOREIGN KEY ("assistantProfileId") REFERENCES "AssistantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
