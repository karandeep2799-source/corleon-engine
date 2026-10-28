import { createHash } from "node:crypto";
import { db } from "@corleon/db";
import { NextRequest, NextResponse } from "next/server";
import { authorizeSandboxRequest, requestId } from "../../../../lib/sandbox/auth";
import { executeSandboxCode } from "../../../../lib/sandbox/runner";
import { isValidIdempotencyKey, sandboxJobInputSchema } from "../../../../lib/sandbox/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function errorResponse(message: string, status: number, rid: string) {
  return NextResponse.json({ error: message, requestId: rid }, {
    status,
    headers: { "Cache-Control": "no-store", "X-Request-Id": rid },
  });
}

export async function POST(request: NextRequest) {
  const rid = requestId(request);
  const auth = authorizeSandboxRequest(request);
  if (auth === "missing_configuration") {
    return errorResponse("Sandbox API is not configured", 503, rid);
  }
  if (auth !== "ok") return errorResponse("Unauthorized", 401, rid);

  const rawIdempotencyKey = request.headers.get("idempotency-key");
  if (rawIdempotencyKey !== null && !isValidIdempotencyKey(rawIdempotencyKey)) {
    return errorResponse("Invalid Idempotency-Key header", 400, rid);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON", 400, rid);
  }

  const parsed = sandboxJobInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      error: "Invalid sandbox job",
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
      requestId: rid,
    }, { status: 400, headers: { "Cache-Control": "no-store", "X-Request-Id": rid } });
  }

  const input = parsed.data;
  const sourceHash = createHash("sha256").update(input.code).digest("hex");

  if (rawIdempotencyKey) {
    const existing = await db.sandboxJob.findUnique({ where: { idempotencyKey: rawIdempotencyKey } });
    if (existing) {
      return NextResponse.json({
        job: {
          id: existing.id,
          status: existing.status,
          runtime: existing.runtime.toLowerCase(),
          exitCode: existing.exitCode,
          stdout: existing.stdout,
          stderr: existing.stderr,
          durationMs: existing.durationMs,
          createdAt: existing.createdAt,
          finishedAt: existing.finishedAt,
        },
        idempotentReplay: true,
        requestId: rid,
      }, { headers: { "Cache-Control": "no-store", "X-Request-Id": rid } });
    }
  }

  let job;
  try {
    job = await db.sandboxJob.create({
      data: {
        idempotencyKey: rawIdempotencyKey ?? undefined,
        runtime: input.runtime === "node" ? "NODE" : "PYTHON",
        sourceHash,
        status: "RUNNING",
      },
    });
    await db.sandboxAuditEvent.create({
      data: {
        jobId: job.id,
        action: "SANDBOX_JOB_STARTED",
        requestId: rid,
        sourceHash,
        details: { runtime: input.runtime },
      },
    });
  } catch (error) {
    // Concurrent requests can race on a unique idempotency key.
    if (rawIdempotencyKey) {
      const existing = await db.sandboxJob.findUnique({ where: { idempotencyKey: rawIdempotencyKey } });
      if (existing) {
        return NextResponse.json({ job: { id: existing.id, status: existing.status }, idempotentReplay: true, requestId: rid }, {
          headers: { "Cache-Control": "no-store", "X-Request-Id": rid },
        });
      }
    }
    console.error("sandbox_job_create_failed", { requestId: rid, error });
    return errorResponse("Unable to create sandbox job", 500, rid);
  }

  try {
    const result = await executeSandboxCode(input);
    const status = result.exitCode === 0 ? "SUCCEEDED" : "FAILED";
    const finishedAt = new Date();
    const updated = await db.sandboxJob.update({
      where: { id: job.id },
      data: {
        status,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: result.durationMs,
        finishedAt,
      },
    });
    await db.sandboxAuditEvent.create({
      data: {
        jobId: job.id,
        action: status === "SUCCEEDED" ? "SANDBOX_JOB_SUCCEEDED" : "SANDBOX_JOB_FAILED",
        requestId: rid,
        sourceHash,
        details: { exitCode: result.exitCode, durationMs: result.durationMs },
      },
    });

    return NextResponse.json({
      job: {
        id: updated.id,
        status: updated.status,
        runtime: input.runtime,
        exitCode: updated.exitCode,
        stdout: updated.stdout,
        stderr: updated.stderr,
        durationMs: updated.durationMs,
        createdAt: updated.createdAt,
        finishedAt: updated.finishedAt,
      },
      requestId: rid,
    }, {
      status: result.exitCode === 0 ? 200 : 422,
      headers: { "Cache-Control": "no-store", "X-Request-Id": rid },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sandbox execution error";
    const timedOut = /timeout|timed out|deadline/i.test(message);
    const finishedAt = new Date();
    await db.sandboxJob.update({
      where: { id: job.id },
      data: {
        status: timedOut ? "TIMED_OUT" : "FAILED",
        errorCode: timedOut ? "SANDBOX_TIMEOUT" : "SANDBOX_EXECUTION_FAILED",
        stderr: timedOut ? "Execution exceeded the sandbox time limit." : "Sandbox execution failed.",
        finishedAt,
        durationMs: finishedAt.getTime() - job.createdAt.getTime(),
      },
    });
    await db.sandboxAuditEvent.create({
      data: {
        jobId: job.id,
        action: timedOut ? "SANDBOX_JOB_TIMED_OUT" : "SANDBOX_JOB_FAILED",
        requestId: rid,
        sourceHash,
        details: { errorType: error instanceof Error ? error.name : "UnknownError" },
      },
    });
    console.error("sandbox_execution_failed", { requestId: rid, jobId: job.id, error });
    return errorResponse(timedOut ? "Sandbox execution timed out" : "Sandbox execution failed", timedOut ? 408 : 502, rid);
  }
}

export async function GET(request: NextRequest) {
  const rid = requestId(request);
  const auth = authorizeSandboxRequest(request);
  if (auth === "missing_configuration") return errorResponse("Sandbox API is not configured", 503, rid);
  if (auth !== "ok") return errorResponse("Unauthorized", 401, rid);

  const jobs = await db.sandboxJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true, status: true, runtime: true, sourceHash: true, exitCode: true,
      durationMs: true, createdAt: true, finishedAt: true, errorCode: true,
    },
  });

  return NextResponse.json({ jobs, requestId: rid }, {
    headers: { "Cache-Control": "no-store", "X-Request-Id": rid },
  });
}
