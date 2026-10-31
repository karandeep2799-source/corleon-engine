import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authorizeSandboxRequest } from "@/lib/sandbox/auth";
import { db } from "@/lib/sandbox/db";
import { executeSandboxCode } from "@/lib/sandbox/runner";
import {
  isValidIdempotencyKey,
  MAX_REQUEST_BYTES,
  sandboxJobInputSchema,
} from "@/lib/sandbox/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function errorResponse(message: string, status: number, requestId: string) {
  return NextResponse.json(
    { error: message, requestId },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    },
  );
}

export async function POST(request: NextRequest) {
  const auth = authorizeSandboxRequest(request);
  if (!auth.ok) return errorResponse(auth.error, auth.status, auth.requestId);

  const rawIdempotencyKey = request.headers.get("idempotency-key");
  if (rawIdempotencyKey !== null && !isValidIdempotencyKey(rawIdempotencyKey)) {
    return errorResponse("Invalid Idempotency-Key header", 400, auth.requestId);
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BYTES) {
      return errorResponse("Request body is too large", 413, auth.requestId);
    }
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse("Request body must be valid JSON", 400, auth.requestId);
  }

  const parsed = sandboxJobInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid sandbox job",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
        requestId: auth.requestId,
      },
      {
        status: 400,
        headers: { "Cache-Control": "no-store", "X-Request-Id": auth.requestId },
      },
    );
  }

  const input = parsed.data;
  const sourceHash = createHash("sha256").update(input.code, "utf8").digest("hex");

  if (rawIdempotencyKey) {
    const existing = await db.sandboxJob.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: auth.tenantId,
          idempotencyKey: rawIdempotencyKey,
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        { job: existing, idempotentReplay: true, requestId: auth.requestId },
        { headers: { "Cache-Control": "no-store", "X-Request-Id": auth.requestId } },
      );
    }
  }

  let job;
  try {
    job = await db.sandboxJob.create({
      data: {
        tenantId: auth.tenantId,
        idempotencyKey: rawIdempotencyKey,
        runtime: input.runtime === "node" ? "NODE" : "PYTHON",
        sourceHash,
        timeoutMs: input.timeoutMs,
        status: "RUNNING",
      },
    });
    await db.sandboxAuditEvent.create({
      data: {
        tenantId: auth.tenantId,
        jobId: job.id,
        action: "SANDBOX_JOB_STARTED",
        requestId: auth.requestId,
        sourceHash,
        details: { runtime: input.runtime, timeoutMs: input.timeoutMs },
      },
    });
  } catch (error) {
    if (rawIdempotencyKey) {
      const existing = await db.sandboxJob.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: auth.tenantId,
            idempotencyKey: rawIdempotencyKey,
          },
        },
      });
      if (existing) {
        return NextResponse.json(
          { job: existing, idempotentReplay: true, requestId: auth.requestId },
          { headers: { "Cache-Control": "no-store", "X-Request-Id": auth.requestId } },
        );
      }
    }
    console.error("sandbox_job_create_failed", { requestId: auth.requestId, error });
    return errorResponse("Unable to create sandbox job", 500, auth.requestId);
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
        tenantId: auth.tenantId,
        jobId: job.id,
        action: status === "SUCCEEDED" ? "SANDBOX_JOB_SUCCEEDED" : "SANDBOX_JOB_FAILED",
        requestId: auth.requestId,
        sourceHash,
        details: { exitCode: result.exitCode, durationMs: result.durationMs },
      },
    });

    return NextResponse.json(
      { job: updated, requestId: auth.requestId },
      {
        status: result.exitCode === 0 ? 200 : 422,
        headers: { "Cache-Control": "no-store", "X-Request-Id": auth.requestId },
      },
    );
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
        tenantId: auth.tenantId,
        jobId: job.id,
        action: timedOut ? "SANDBOX_JOB_TIMED_OUT" : "SANDBOX_JOB_FAILED",
        requestId: auth.requestId,
        sourceHash,
        details: { errorType: error instanceof Error ? error.name : "UnknownError" },
      },
    });
    console.error("sandbox_execution_failed", { requestId: auth.requestId, jobId: job.id, error });
    return errorResponse(
      timedOut ? "Sandbox execution timed out" : "Sandbox execution failed",
      timedOut ? 408 : 502,
      auth.requestId,
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = authorizeSandboxRequest(request);
  if (!auth.ok) return errorResponse(auth.error, auth.status, auth.requestId);

  const jobs = await db.sandboxJob.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      runtime: true,
      sourceHash: true,
      exitCode: true,
      durationMs: true,
      timeoutMs: true,
      createdAt: true,
      finishedAt: true,
      errorCode: true,
    },
  });

  return NextResponse.json(
    { jobs, requestId: auth.requestId },
    { headers: { "Cache-Control": "no-store", "X-Request-Id": auth.requestId } },
  );
}
