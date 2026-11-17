import { NextResponse } from "next/server";
import {
  BinanceMarketDataError,
  getBinance24HourTicker,
} from "../../../../../lib/binance/market-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
};

export async function GET(request: Request) {
  if (process.env.BINANCE_MARKET_DATA_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Binance market-data integration is disabled." },
      { status: 503, headers: responseHeaders },
    );
  }

  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol") ?? "BTCUSDT";

  try {
    const ticker = await getBinance24HourTicker(symbol);
    return NextResponse.json(
      {
        exchange: "binance",
        market: "spot",
        dataType: "24h-ticker",
        retrievedAt: new Date().toISOString(),
        data: ticker,
      },
      { headers: responseHeaders },
    );
  } catch (error) {
    if (error instanceof BinanceMarketDataError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: responseHeaders },
      );
    }

    return NextResponse.json(
      { error: "Unable to retrieve Binance market data." },
      { status: 500, headers: responseHeaders },
    );
  }
}
