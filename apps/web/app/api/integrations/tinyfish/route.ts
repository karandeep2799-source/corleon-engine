import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { executeTinyFishAction, TinyFishError, type TinyFishAction } from "../../../../lib/tinyfish";

export const runtime = "nodejs";
export const maxDuration = 300;

const ACTIONS = new Set<TinyFishAction>([
  "agent.run", "search.query", "fetch.contents", "research.run", "wallet.get",
  "monitors.list", "monitors.create", "monitors.get", "monitors.update", "monitors.run", "monitors.delete",
  "datasets.list", "datasets.plan", "datasets.create", "datasets.get", "datasets.rows", "datasets.populate", "datasets.cancel", "datasets.delete",
  "profiles.list", "profiles.create", "profiles.setup", "profiles.save",
]);

function authorized(request: NextRequest): boolean {
  const expected = process.env.CORLEON_TINYFISH_ACCESS_TOKEN;
  const supplied = request.headers.get("x-corleon-tinyfish-token") ?? "";
  if (!expected || !supplied) return false;
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await executeTinyFishAction("wallet.get", {});
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await request.text();
  if (raw.length > 64 * 1024) return NextResponse.json({ error: "Request body exceeds 64 KB." }, { status: 413 });

  let payload: unknown;
  try { payload = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.action !== "string" || !ACTIONS.has(record.action as TinyFishAction)) {
    return NextResponse.json({ error: "Unsupported TinyFish action." }, { status: 400 });
  }

  try {
    const result = await executeTinyFishAction(record.action as TinyFishAction, record.input ?? {});
    if (result instanceof Response) return result;
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof TinyFishError) {
    const status = error.status >= 400 && error.status <= 599 ? error.status : 502;
    return NextResponse.json({
      error: error.message,
      code: error.code ?? "TINYFISH_ERROR",
      ...(process.env.NODE_ENV !== "production" && error.details ? { details: error.details } : {}),
    }, { status });
  }
  return NextResponse.json({ error: "TinyFish integration request failed.", code: "INTERNAL_ERROR" }, { status: 500 });
}
