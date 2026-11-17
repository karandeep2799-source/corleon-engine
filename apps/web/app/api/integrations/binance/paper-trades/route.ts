import { NextResponse } from "next/server";
import { isAuthorizedPortfolioRequest } from "../../../../../lib/binance/portfolio-access";
import { previewPaperTrade } from "../../../../../lib/binance/paper-trading";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: Request) {
  if (process.env.BINANCE_PAPER_TRADING_ENABLED !== "true") return NextResponse.json({ error: "Paper trading is disabled." }, { status: 503, headers });
  if (!isAuthorizedPortfolioRequest(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "A JSON trade request is required." }, { status: 400, headers });
  const value = body as Record<string, unknown>;
  if (typeof value.symbol !== "string" || typeof value.side !== "string" || typeof value.quantity !== "number") return NextResponse.json({ error: "symbol, side and numeric quantity are required." }, { status: 400, headers });
  try {
    const preview = await previewPaperTrade({ symbol: value.symbol, side: value.side as "BUY" | "SELL", quantity: value.quantity });
    return NextResponse.json(preview, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Paper trade preview failed." }, { status: 400, headers });
  }
}
