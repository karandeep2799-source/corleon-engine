import { NextResponse } from "next/server";
import {
  BinancePrivateApiError,
  getBinanceAccountSnapshot,
} from "../../../../../lib/binance/private-account";
import { hasBinanceServiceAuthorization } from "../../../../../lib/binance/service-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasBinanceServiceAuthorization(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  if (process.env.BINANCE_ACCOUNT_MONITORING_ENABLED !== "true") {
    return NextResponse.json({ error: "Binance account monitoring is disabled." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const account = await getBinanceAccountSnapshot();
    return NextResponse.json(
      {
        exchange: "binance",
        accountType: account.accountType,
        permissions: {
          canTrade: account.canTrade,
          canWithdraw: account.canWithdraw,
          canDeposit: account.canDeposit,
        },
        updateTime: account.updateTime,
        retrievedAt: new Date().toISOString(),
        balances: account.balances,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof BinancePrivateApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Unable to retrieve Binance account data." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
