import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { WeeglooMcpClient, WeeglooMcpError, resolveWeeglooEndpoint } from "@/lib/weegloo/mcp-client";
import { isReadOnlyToolAllowed, parseReadOnlyToolAllowlist } from "@/lib/weegloo/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const expected = process.env.CORLEON_INTEGRATION_API_KEY;
  const supplied = request.headers.get("x-corleon-integration-key") ?? "";

  if (!expected || !supplied) return false;

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function authFailure(): NextResponse {
  if (!process.env.CORLEON_INTEGRATION_API_KEY) {
    return NextResponse.json(
      { error: "Integration gateway is not configured." },
      { status: 503 },
    );
  }

  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

function ensureEnabled(): NextResponse | null {
  if (process.env.WEEGLOO_ENABLED !== "true") {
    return NextResponse.json(
      { error: "WEEGLOO integration is disabled. Enable it only after configuration review." },
      { status: 503 },
    );
  }
  return null;
}

function clientFor(request: NextRequest): WeeglooMcpClient | NextResponse {
  const token = request.headers.get("x-weegloo-access-token") ?? "";
  if (!token || /[\r\n]/.test(token)) {
    return NextResponse.json(
      { error: "A WEEGLOO OAuth access token is required for this request." },
      { status: 401 },
    );
  }

  try {
    return new WeeglooMcpClient({
      accessToken: token,
      endpoint: process.env.WEEGLOO_MCP_URL,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid WEEGLOO configuration." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return authFailure();

  let endpoint: string;
  try {
    endpoint = resolveWeeglooEndpoint(process.env.WEEGLOO_MCP_URL);
  } catch {
    return NextResponse.json({ error: "Invalid WEEGLOO MCP endpoint configuration." }, { status: 500 });
  }

  return NextResponse.json({
    provider: "weegloo",
    enabled: process.env.WEEGLOO_ENABLED === "true",
    endpoint,
    authentication: "per-request-oauth-bearer",
    executionMode: "read-only",
    writeOperations: "blocked",
    configuredReadOnlyTools: parseReadOnlyToolAllowlist(
      process.env.WEEGLOO_READ_ONLY_TOOLS,
    ).size,
  });
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return authFailure();

  const disabled = ensureEnabled();
  if (disabled) return disabled;

  const client = clientFor(request);
  if (client instanceof NextResponse) return client;

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Unable to read request body." }, { status: 400 });
  }

  if (new TextEncoder().encode(rawBody).byteLength > 32 * 1024) {
    return NextResponse.json({ error: "Request body exceeds the 32 KB limit." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;

  try {
    if (input.operation === "tools/list") {
      const cursor = typeof input.cursor === "string" ? input.cursor : undefined;
      const result = await client.listTools(cursor);
      return NextResponse.json({ result });
    }

    if (input.operation === "tools/call") {
      if (typeof input.name !== "string") {
        return NextResponse.json({ error: "Tool name is required." }, { status: 400 });
      }

      const allowlist = parseReadOnlyToolAllowlist(process.env.WEEGLOO_READ_ONLY_TOOLS);
      if (!isReadOnlyToolAllowed(input.name, allowlist)) {
        console.warn(JSON.stringify({
          event: "integration.weegloo.tool_blocked",
          toolName: input.name,
          reason: "not_allowlisted_or_mutating",
          timestamp: new Date().toISOString(),
        }));
        return NextResponse.json(
          { error: "Tool is not approved for read-only execution." },
          { status: 403 },
        );
      }

      const args = input.arguments;
      if (args !== undefined && (!args || typeof args !== "object" || Array.isArray(args))) {
        return NextResponse.json({ error: "Tool arguments must be a JSON object." }, { status: 400 });
      }

      const result = await client.callTool(
        input.name,
        (args ?? {}) as Record<string, unknown>,
      );

      console.info(JSON.stringify({
        event: "integration.weegloo.tool_call",
        toolName: input.name,
        decision: "allowed",
        timestamp: new Date().toISOString(),
      }));

      return NextResponse.json({ result });
    }

    return NextResponse.json(
      { error: "Supported operations are tools/list and tools/call." },
      { status: 400 },
    );
  } catch (error) {
    const status = error instanceof WeeglooMcpError ? error.statusCode : 502;
    const message = error instanceof Error ? error.message : "WEEGLOO request failed.";
    return NextResponse.json({ error: message }, { status });
  }
}
