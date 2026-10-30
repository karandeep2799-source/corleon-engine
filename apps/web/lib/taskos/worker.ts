import { db } from './db';
import { syncGoogleToCorleon } from './google';

type ClaimedJob = { id: string; tenantId: string; kind: string; payload: unknown; attempts: number; maxAttempts: number };
export async function runTaskJobBatch(workerId: string, limit = 10) {
  const jobs = await db.$queryRaw<ClaimedJob[]> `
    WITH picked AS (
      SELECT "id" FROM "TaskJob"
      WHERE "status" = 'PENDING'::"TaskJobStatus" AND "runAt" <= NOW()
      ORDER BY "runAt" ASC
      FOR UPDATE SKIP LOCKED LIMIT ${Math.min(Math.max(limit, 1), 25)}
    )
    UPDATE "TaskJob" AS j SET "status" = 'RUNNING'::"TaskJobStatus", "lockedAt" = NOW(), "lockedBy" = ${workerId}, "attempts" = j."attempts" + 1, "updatedAt" = NOW()
    FROM picked WHERE j."id" = picked."id"
    RETURNING j."id", j."tenantId", j."kind", j."payload", j."attempts", j."maxAttempts"
  `;
  let succeeded = 0, failed = 0;
  for (const job of jobs) {
    try {
      const payload = job.payload as { userId?: string };
      if (job.kind === 'google.tasks.sync' && payload.userId) await syncGoogleToCorleon(job.tenantId, payload.userId);
      else throw new Error('Unsupported job kind or missing userId');
      await db.taskJob.update({ where: { id: job.id }, data: { status: 'SUCCEEDED', lockedAt: null, lockedBy: null, lastError: null } });
      succeeded++;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 2000) : 'Unknown worker error';
      const dead = job.attempts >= job.maxAttempts;
      await db.taskJob.update({ where: { id: job.id }, data: { status: dead ? 'DEAD' : 'PENDING', runAt: new Date(Date.now() + Math.min(60_000 * 2 ** job.attempts, 6 * 60 * 60_000)), lockedAt: null, lockedBy: null, lastError: message } });
      failed++;
    }
  }
  return { claimed: jobs.length, succeeded, failed };
}
