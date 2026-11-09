import { NextRequest, NextResponse } from "next/server";
import { bitcoinPrisma } from "@/lib/bitcoin/prisma";
import { getStockSession, isSameOrigin } from "@/lib/stocks/session";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getStockSession();
  if (!session) return NextResponse.json({ error: "Connect Gmail to review transactions." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[a-zA-Z0-9_-]{8,40}$/.test(id)) return NextResponse.json({ error: "Invalid transaction id." }, { status: 400 });
  let body: { action?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (body.action !== "CONFIRM" && body.action !== "IGNORE") return NextResponse.json({ error: "Unsupported review action." }, { status: 400 });
  try {
    const result = await bitcoinPrisma.stockTransaction.updateMany({
      where: { id, ownerEmail: session.email, reviewStatus: "NEEDS_REVIEW" },
      data: { reviewStatus: body.action === "CONFIRM" ? "CONFIRMED" : "IGNORED" },
    });
    if (!result.count) return NextResponse.json({ error: "Transaction not found or already reviewed." }, { status: 404 });
    return NextResponse.json({ ok: true, reviewStatus: body.action === "CONFIRM" ? "CONFIRMED" : "IGNORED" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Stock transaction review failed", error);
    return NextResponse.json({ error: "Could not update this transaction." }, { status: 500 });
  }
}
