import { NextRequest, NextResponse } from "next/server";
import { getAddressActivity, getSupportedChains, hasBlockscoutApiKey, validateAddress } from "../../../../../lib/blockscout/client";
import { isRateLimited } from "../../../../../lib/blockscout/rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    if (await isRateLimited(request, "activity", 30)) return NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  } catch {
    return NextResponse.json({ error: "Rate limiting is temporarily unavailable." }, { status: 503 });
  }
  if (!hasBlockscoutApiKey()) return NextResponse.json({ error: "Blockscout API key is not configured." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const payload = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  if (typeof payload.address !== "string" || typeof payload.chainId !== "string") return NextResponse.json({ error: "address and chainId are required." }, { status: 400 });
  let address: string;
  try { address = validateAddress(payload.address); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid address." }, { status: 400 }); }
  try {
    const chains = await getSupportedChains();
    const chain = chains.find((item) => item.id === payload.chainId);
    if (!chain) return NextResponse.json({ error: "Unsupported Blockscout network." }, { status: 404 });
    const activity = await getAddressActivity(chain.id, address, payload.cursor);
    return NextResponse.json({ address, chain, ...activity, readOnly: true }, { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Activity request failed.";
    const status = message.toLowerCase().includes("cursor") ? 400 : 502;
    return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
