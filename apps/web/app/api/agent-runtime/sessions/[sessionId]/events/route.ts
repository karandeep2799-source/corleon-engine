import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { isAgentRuntimeAuthorized, unauthorizedResponse, runtimeDisabledResponse } from "@/src/lib/agent-runtime/auth";
import { prisma } from "@/src/lib/agent-runtime/db";
import { getAgentRuntimeProvider } from "@/src/lib/agent-runtime/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RuntimeEvent = { type?: string; event_id?: string; run_id?: string; data?: Record<string, unknown> };

async function persistEvent(event: RuntimeEvent, jobId: string, sessionId: string, organizationId: string) {
  const data = event.data ?? {};
  if (event.type === "run.human_input_requested" && typeof data.hitl_id === "string") {
    const toolName = `hitl:${data.hitl_id}`;
    const existing = await prisma.agentRuntimeApproval.findFirst({
      where: { jobId, toolName, status: "PENDING" }, select: { id: true },
    });
    if (!existing) {
      await prisma.$transaction([
        prisma.agentRuntimeApproval.create({
          data: {
            jobId, sessionId, organizationId, toolName,
            request: { hitl_id: data.hitl_id, payload: data.payload ?? null, event_id: event.event_id ?? null } as Prisma.InputJsonValue,
          },
        }),
        prisma.agentRuntimeJob.updateMany({
          where: { id: jobId, status: "RUNNING" }, data: { status: "AWAITING_APPROVAL" },
        }),
        prisma.agentRuntimeAuditEvent.create({
          data: { organizationId, jobId, sessionId, actorType: "runtime", action: "approval.requested", details: { hitlId: data.hitl_id, eventId: event.event_id ?? null } },
        }),
      ]);
    }
    return;
  }

  if (event.type === "run.human_input_received" && typeof data.hitl_id === "string") {
    const outcome = data.outcome === "HITL_OUTCOME_APPROVE" ? "APPROVED" : data.outcome === "HITL_OUTCOME_REJECT" ? "DENIED" : null;
    if (outcome) {
      const approval = await prisma.agentRuntimeApproval.findFirst({ where: { jobId, toolName: `hitl:${data.hitl_id}`, status: "PENDING" } });
      if (approval) {
        await prisma.$transaction([
          prisma.agentRuntimeApproval.update({ where: { id: approval.id }, data: { status: outcome, reviewedAt: new Date(), reviewedBy: "runtime-event", decisionNote: typeof data.reason === "string" ? data.reason.slice(0, 2000) : null } }),
          prisma.agentRuntimeJob.updateMany({ where: { id: jobId, status: "AWAITING_APPROVAL" }, data: { status: "RUNNING" } }),
          prisma.agentRuntimeAuditEvent.create({ data: { organizationId, jobId, sessionId, actorType: "runtime", action: "approval.resolved", details: { hitlId: data.hitl_id, outcome, eventId: event.event_id ?? null } } }),
        ]);
      }
    }
    return;
  }

  if (event.type === "run.completed" || event.type === "run.failed") {
    const status = event.type === "run.completed" ? "SUCCEEDED" : "FAILED";
    await prisma.$transaction([
      prisma.agentRuntimeJob.updateMany({ where: { id: jobId, status: { in: ["RUNNING", "AWAITING_APPROVAL"] } }, data: { status, finishedAt: new Date(), ...(status === "FAILED" ? { errorCode: "REMOTE_RUN_FAILED", errorMessage: typeof data.message === "string" ? data.message.slice(0, 1000) : "Remote agent run failed" } : {}) } }),
      prisma.agentRuntimeSession.update({ where: { id: sessionId }, data: { lastEventAt: new Date() } }),
      prisma.agentRuntimeAuditEvent.create({ data: { organizationId, jobId, sessionId, actorType: "runtime", action: status === "SUCCEEDED" ? "job.completed" : "job.failed", details: { eventId: event.event_id ?? null, runId: event.run_id ?? null } } }),
    ]);
    return;
  }

  await prisma.agentRuntimeSession.update({ where: { id: sessionId }, data: { lastEventAt: new Date() } });
}

function eventEnvelope(frame: string): RuntimeEvent | null {
  const lines = frame.split(/\r?\n/);
  const data = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
  if (!data) return null;
  try { return JSON.parse(data) as RuntimeEvent; } catch { return null; }
}

export async function GET(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  if (!isAgentRuntimeAuthorized(request)) return unauthorizedResponse();
  if (process.env.CORLEON_AGENT_RUNTIME_ENABLED !== "true") return runtimeDisabledResponse();

  const { sessionId } = await context.params;
  const session = await prisma.agentRuntimeSession.findUnique({ where: { id: sessionId }, include: { job: true } });
  if (!session?.externalSessionId) return Response.json({ error: "session_not_found" }, { status: 404 });

  const cursor = request.nextUrl.searchParams.get("cursor") ?? request.headers.get("last-event-id") ?? undefined;
  const replayOnly = request.nextUrl.searchParams.get("replay_only") === "true";
  const replayFrom = request.nextUrl.searchParams.get("replay_from") ?? undefined;

  try {
    const upstream = await getAgentRuntimeProvider().openSessionEvents(session.externalSessionId, { cursor, replayOnly, replayFrom, signal: request.signal });
    if (!upstream.body) return Response.json({ error: "empty_event_stream" }, { status: 502 });

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";
    const reader = upstream.body.getReader();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            buffer += decoder.decode();
            if (buffer.trim()) {
              const event = eventEnvelope(buffer);
              if (event) await persistEvent(event, session.jobId, session.id, session.job.organizationId);
              controller.enqueue(encoder.encode(buffer));
            }
            controller.close();
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split(/\r?\n\r?\n/);
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            const event = eventEnvelope(frame);
            if (event) await persistEvent(event, session.jobId, session.id, session.job.organizationId);
            controller.enqueue(encoder.encode(frame + "\n\n"));
          }
        } catch (error) {
          controller.error(error);
        }
      },
      async cancel() { await reader.cancel(); },
    });

    return new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", Connection: "keep-alive" },
    });
  } catch (error) {
    return Response.json({ error: "event_stream_unavailable", message: error instanceof Error ? error.message.slice(0, 500) : "Unknown error" }, { status: 502 });
  }
}
