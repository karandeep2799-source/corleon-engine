import { NextRequest } from "next/server";
import { isAgentRuntimeAuthorized, unauthorizedResponse } from "@/src/lib/agent-runtime/auth";
import { prisma } from "@/src/lib/agent-runtime/db";
import { getAgentRuntimeProvider } from "@/src/lib/agent-runtime/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ approvalId: string }> }) {
  if (!isAgentRuntimeAuthorized(request)) return unauthorizedResponse();
  const { approvalId } = await context.params;
  const body = await request.json().catch(() => null);
  if (!["APPROVED", "DENIED"].includes(body?.decision)) {
    return Response.json({ error: "decision must be APPROVED or DENIED" }, { status: 400 });
  }
  const current = await prisma.agentRuntimeApproval.findUnique({
    where: { id: approvalId }, include: { session: true },
  });
  if (!current) return Response.json({ error: "approval_not_found" }, { status: 404 });
  if (current.status !== "PENDING") return Response.json({ error: "approval_already_resolved" }, { status: 409 });
  if (!current.session?.externalSessionId) return Response.json({ error: "approval_session_missing" }, { status: 409 });

  const requestData = current.request && typeof current.request === "object" && !Array.isArray(current.request)
    ? current.request as Record<string, unknown> : {};
  const hitlId = typeof requestData.hitl_id === "string" ? requestData.hitl_id : null;
  if (!hitlId) return Response.json({ error: "approval_missing_runtime_request_id" }, { status: 409 });

  try {
    const provider = getAgentRuntimeProvider();
    await provider.resolveHITL(
      current.session.externalSessionId,
      hitlId,
      body.decision === "APPROVED" ? "HITL_OUTCOME_APPROVE" : "HITL_OUTCOME_REJECT",
      typeof body.note === "string" ? body.note.slice(0, 2000) : undefined,
    );

    const approval = await prisma.$transaction(async (tx) => {
      const changed = await tx.agentRuntimeApproval.updateMany({
        where: { id: approvalId, status: "PENDING" },
        data: {
          status: body.decision, reviewedAt: new Date(),
          reviewedBy: typeof body.reviewerId === "string" ? body.reviewerId.slice(0, 128) : "service",
          decisionNote: typeof body.note === "string" ? body.note.slice(0, 2000) : null,
        },
      });
      if (changed.count !== 1) throw new Error("approval_race");
      await tx.agentRuntimeAuditEvent.create({
        data: {
          organizationId: current.organizationId, jobId: current.jobId, sessionId: current.sessionId,
          actorType: "service", actorId: typeof body.reviewerId === "string" ? body.reviewerId.slice(0, 128) : null,
          action: body.decision === "APPROVED" ? "approval.approved" : "approval.denied",
          details: { approvalId, hitlId },
        },
      });
      return tx.agentRuntimeApproval.findUnique({ where: { id: approvalId } });
    });
    return Response.json({ approval });
  } catch (error) {
    return Response.json({
      error: "approval_resolution_failed",
      message: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
    }, { status: 502 });
  }
}
