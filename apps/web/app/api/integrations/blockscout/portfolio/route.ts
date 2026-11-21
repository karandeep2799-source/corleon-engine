import { NextRequest, NextResponse } from "next/server";
import { getChainPortfolio, getSupportedChains, hasBlockscoutApiKey, validateAddress } from "../../../../../lib/blockscout/client";
import { isRateLimited } from "../../../../../lib/blockscout/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;
const DEFAULT_CHAIN_IDS = ["1", "10", "100", "42161", "42220", "4663"];

function maxChainsPerRequest(): number {
  const configured = Number(process.env.BLOCKSCOUT_MAX_CHAINS_PER_REQUEST ?? 6);
  return Number.isInteger(configured) ? Math.min(12, Math.max(1, configured)) : 6;
}

export async function POST(request: NextRequest) {
  try {
    if (await isRateLimited(request, "portfolio", 10)) return NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  } catch {
    return NextResponse.json({ error: "Rate limiting is temporarily unavailable." }, { status: 503 });
  }
  if (!hasBlockscoutApiKey()) {
    return NextResponse.json({ error: "Blockscout is not configured. Add BLOCKSCOUT_PRO_API_KEY to the Vercel server environment." }, { status: 503 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const payload = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  let address: string;
  try {
    if (typeof payload.address !== "string") throw new Error("A wallet address is required.");
    address = validateAddress(payload.address);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid wallet address." }, { status: 400 });
  }
  const requested = Array.isArray(payload.chainIds) ? payload.chainIds : (process.env.BLOCKSCOUT_DEFAULT_CHAIN_IDS ?? DEFAULT_CHAIN_IDS.join(",")).split(",");
  if (!requested.length || requested.length > maxChainsPerRequest()) return NextResponse.json({ error: "Select between 1 and " + maxChainsPerRequest() + " networks per request." }, { status: 400 });
  if (requested.some((id) => typeof id !== "string" || !/^\d{1,10}$/.test(id))) return NextResponse.json({ error: "Every chain ID must be a numeric string." }, { status: 400 });
  const ids = [...new Set(requested as string[])];
  if (ids.length !== requested.length) return NextResponse.json({ error: "Duplicate chain IDs are not allowed." }, { status: 400 });

  try {
    const allChains = await getSupportedChains();
    const chainMap = new Map(allChains.map((chain) => [chain.id, chain]));
    const unsupported = ids.filter((id) => !chainMap.has(id));
    if (unsupported.length) return NextResponse.json({ error: "Unsupported Blockscout network(s): " + unsupported.join(", ") + "." }, { status: 400 });
    const results = await Promise.all(ids.map((id) => getChainPortfolio(chainMap.get(id)!, address)));
    return NextResponse.json({
      address, generatedAt: new Date().toISOString(), supportedChainCount: allChains.length, queriedChainCount: results.length,
      chains: results,
      totals: {
        chainsWithActivity: results.filter((item) => item.nativeBalance !== null || item.tokens.length > 0).length,
        tokenCount: results.reduce((sum, item) => sum + item.tokens.length, 0),
        transactionCount: results.reduce((sum, item) => sum + (item.transactionCount ?? 0), 0),
      },
      readOnly: true,
    }, { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Portfolio request failed." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
