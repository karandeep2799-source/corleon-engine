import { NextResponse } from "next/server";
import { BinancePrivateApiError, getBinanceSpotAccount } from "../../../../../lib/binance/private-account";
import { isAuthorizedPortfolioRequest } from "../../../../../lib/binance/portfolio-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: Request) {
  if (process.env.BINANCE_PRIVATE_API_ENABLED !== "true") return NextResponse.json({ error: "Binance portfolio monitoring is disabled." }, { status: 503, headers });
  if (!isAuthorizedPortfolioRequest(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers });
  try {
    const account = await getBinanceSpotAccount();
    return NextResponse.json({
      exchange: "binance", accountType: account.accountType, retrievedAt: new Date().toISOString(),
      permissions: { canTrade: account.canTrade, canWithdraw: account.canWithdraw, canDeposit: account.canDeposit },
      balances: account.balances,
      valuation: { status: "not_calculated", note: "Balances are returned in native asset units; quote valuation is intentionally omitted until fresh quote prices are integrated." },
    }, { headers });
  } catch (error) {
    if (error instanceof BinancePrivateApiError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    return NextResponse.json({ error: "Unable to retrieve Binance portfolio." }, { status: 500, headers });
  }
}
