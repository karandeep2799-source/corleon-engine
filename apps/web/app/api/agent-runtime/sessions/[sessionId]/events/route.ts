import { NextRequest } from "next/server";
import { isAgentRuntimeAuthorized, unauthorizedResponse, runtimeDisabledResponse } from "@/src/lib/agent-runtime/auth";
import { prisma } from "@/src/lib/agent-runtime/db";
import { getAgentRuntimeProvider } from "@/src/lib/agent-runtime/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  if (!isAgentRuntimeAuthorized(request)) return unauthorizedResponse();
  if (process.env.CORLEON_AGENT_RUNTIME_ENABLED !== "true") return runtimeDisabledResponse();

  const { sessionId } = await context.params;
  const session = await prisma.agentRuntimeSession.findUnique({
    where: { id: sessionId }, include: { job: true },
  });
  if (!session?.externalSessionId) return Response.json({ error: "session_not_found" }, { status: 404 });

  const cursor = request.nextUrl.searchParams.get("cursor") ?? request.headers.get("last-event-id") ?? undefined;
  const replayOnly = request.nextUrl.searchParams.get("replay_only") === "true";
  const replayFrom = request.nextUrl.searchParams.get("replay_from") ?? undefined;

  try {
    const upstream = await getAgentRuntimeProvider().openSessionEvents(session.externalSessionId, {
      cursor, replayOnly, replayFrom, signal: request.signal,
    });
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return Response.json({
      error: "event_stream_unavailable",
      message: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
    }, { status: 502 });
  }
}
