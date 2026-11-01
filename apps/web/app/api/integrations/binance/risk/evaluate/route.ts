import { NextResponse } from "next/server";
import { assessSpotOrderRisk } from "../../../../../../lib/binance/risk-policy";
import { isAuthorizedPortfolioRequest } from "../../../../../../lib/binance/portfolio-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAuthorizedPortfolioRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  if (process.env.BINANCE_PAPER_TRADING_ENABLED !== "true") {
    return NextResponse.json({ error: "Binance risk evaluation is disabled." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "A JSON order proposal is required." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const input = body as Record<string, unknown>;
  if (
    typeof input.symbol !== "string" ||
    (input.side !== "BUY" && input.side !== "SELL") ||
    typeof input.quantity !== "number" ||
    typeof input.referencePrice !== "number"
  ) {
    return NextResponse.json({ error: "Expected symbol, BUY/SELL side, numeric quantity and numeric referencePrice." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const assessment = assessSpotOrderRisk({
    symbol: input.symbol,
    side: input.side,
    quantity: input.quantity,
    referencePrice: input.referencePrice,
  });

  return NextResponse.json(
    {
      ...assessment,
      evaluatedAt: new Date().toISOString(),
      policyVersion: "binance-spot-risk-v1",
      notice: "This assessment is advisory and simulation-only. It is not authorization to place a live order.",
    },
    { status: assessment.decision === "REJECTED" ? 422 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
