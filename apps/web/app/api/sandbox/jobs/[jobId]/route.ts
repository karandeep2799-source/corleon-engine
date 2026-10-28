import { db } from "@corleon/db";
import { NextRequest, NextResponse } from "next/server";
import { authorizeSandboxRequest, requestId } from "../../../../../lib/sandbox/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  const rid = requestId(request);
  const auth = authorizeSandboxRequest(request);
  if (auth === "missing_configuration") {
    return NextResponse.json({ error: "Sandbox API is not configured", requestId: rid }, { status: 503 });
  }
  if (auth !== "ok") {
    return NextResponse.json({ error: "Unauthorized", requestId: rid }, { status: 401 });
  }

  const { jobId } = await context.params;
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(jobId)) {
    return NextResponse.json({ error: "Invalid job id", requestId: rid }, { status: 400 });
  }

  const job = await db.sandboxJob.findUnique({
    where: { id: jobId },
    select: {
      id: true, status: true, runtime: true, sourceHash: true, exitCode: true,
      stdout: true, stderr: true, errorCode: true, durationMs: true,
      createdAt: true, updatedAt: true, finishedAt: true,
    },
  });

  if (!job) return NextResponse.json({ error: "Job not found", requestId: rid }, { status: 404 });
  return NextResponse.json({ job, requestId: rid }, {
    headers: { "Cache-Control": "no-store", "X-Request-Id": rid },
  });
}
