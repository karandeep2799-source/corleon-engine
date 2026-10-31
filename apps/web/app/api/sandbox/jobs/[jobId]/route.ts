import { NextRequest, NextResponse } from "next/server";
import { authorizeSandboxRequest } from "@/lib/sandbox/auth";
import { db } from "@/lib/sandbox/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number, requestId: string) {
  return NextResponse.json(
    { error: message, requestId },
    { status, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  const auth = authorizeSandboxRequest(request);
  if (!auth.ok) return errorResponse(auth.error, auth.status, auth.requestId);

  const { jobId } = await context.params;
  const job = await db.sandboxJob.findFirst({
    where: { id: jobId, tenantId: auth.tenantId },
    include: {
      auditEvents: {
        orderBy: { createdAt: "asc" },
        select: { action: true, requestId: true, details: true, createdAt: true },
      },
    },
  });

  if (!job) return errorResponse("Sandbox job not found", 404, auth.requestId);

  return NextResponse.json(
    { job, requestId: auth.requestId },
    { headers: { "Cache-Control": "no-store", "X-Request-Id": auth.requestId } },
  );
}
