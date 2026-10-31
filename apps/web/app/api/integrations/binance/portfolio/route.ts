import { NextResponse } from "next/server";
import { BinancePrivateApiError, getBinanceAccountSnapshot } from "../../../../../lib/binance/private-account";
import { getBinance24HourTicker } from "../../../../../lib/binance/market-data";
import { isAuthorizedPortfolioRequest } from "../../../../../lib/binance/portfolio-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: Request) {
  if (process.env.BINANCE_PRIVATE_API_ENABLED !== "true") return NextResponse.json({ error: "Binance portfolio monitoring is disabled." }, { status: 503, headers });
  if (!isAuthorizedPortfolioRequest(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers });
  try {
    const account = await getBinanceAccountSnapshot();
    const balances = account.balances;
    // Bound quote lookups to avoid unbounded fan-out from large exchange accounts.
    const priced = await Promise.all(balances.slice(0, 20).map(async (balance) => {
      const amount = Number(balance.free) + Number(balance.locked);
      if (balance.asset === "USDT") return { asset: balance.asset, amount, quoteAsset: "USDT", price: 1, valueUsdt: amount, priceStatus: "stablecoin_reference" };
      try {
        const ticker = await getBinance24HourTicker(`${balance.asset}USDT`);
        const price = Number(ticker.lastPrice);
        if (!Number.isFinite(price) || price <= 0) throw new Error("Invalid quote");
        return { asset: balance.asset, amount, quoteAsset: "USDT", price, valueUsdt: amount * price, priceStatus: "quoted" };
      } catch {
        return { asset: balance.asset, amount, quoteAsset: "USDT", price: null, valueUsdt: null, priceStatus: "unavailable" };
      }
    }));
    const total = priced.reduce((sum, item) => sum + (item.valueUsdt ?? 0), 0);
    const incomplete = balances.length > priced.length || priced.some(item => item.valueUsdt === null);
    return NextResponse.json({
      exchange: "binance", market: "spot", accountType: account.accountType, retrievedAt: new Date().toISOString(),
      permissions: { canTrade: account.canTrade, canWithdraw: account.canWithdraw, canDeposit: account.canDeposit },
      balances,
      valuation: { quoteAsset: "USDT", estimatedTotal: total, coverage: priced.length, totalAssets: balances.length, complete: !incomplete, assets: priced,
        note: "Indicative Spot valuation only. Assets without a direct ASSETUSDT market and assets beyond the first 20 are excluded from the estimate." },
    }, { headers });
  } catch (error) {
    if (error instanceof BinancePrivateApiError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    return NextResponse.json({ error: "Unable to retrieve Binance portfolio." }, { status: 500, headers });
  }
}
