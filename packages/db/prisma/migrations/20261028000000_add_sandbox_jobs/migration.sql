CREATE TYPE "SandboxJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'TIMED_OUT');
CREATE TYPE "SandboxRuntime" AS ENUM ('NODE', 'PYTHON');

CREATE TABLE "SandboxJob" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "status" "SandboxJobStatus" NOT NULL DEFAULT 'PENDING',
    "runtime" "SandboxRuntime" NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "exitCode" INTEGER,
    "stdout" TEXT,
    "stderr" TEXT,
    "errorCode" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "SandboxJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SandboxAuditEvent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "action" TEXT NOT NULL,
    "requestId" TEXT,
    "sourceHash" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SandboxAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SandboxJob_idempotencyKey_key" ON "SandboxJob"("idempotencyKey");
CREATE INDEX "SandboxJob_status_createdAt_idx" ON "SandboxJob"("status", "createdAt");
CREATE INDEX "SandboxJob_createdAt_idx" ON "SandboxJob"("createdAt");
CREATE INDEX "SandboxAuditEvent_jobId_createdAt_idx" ON "SandboxAuditEvent"("jobId", "createdAt");
CREATE INDEX "SandboxAuditEvent_action_createdAt_idx" ON "SandboxAuditEvent"("action", "createdAt");

ALTER TABLE "SandboxAuditEvent"
ADD CONSTRAINT "SandboxAuditEvent_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "SandboxJob"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
