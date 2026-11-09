import { NextRequest, NextResponse } from "next/server";
import { bitcoinPrisma } from "@/lib/bitcoin/prisma";
import { getStockSession, isSameOrigin } from "@/lib/stocks/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getStockSession();
  if (!session) return NextResponse.json({ error: "Not connected." }, { status: 401 });
  try {
    await bitcoinPrisma.$transaction([
      bitcoinPrisma.stockTransaction.deleteMany({ where: { ownerEmail: session.email } }),
      bitcoinPrisma.stockEmailEvidence.deleteMany({ where: { ownerEmail: session.email } }),
      bitcoinPrisma.stockSyncState.deleteMany({ where: { ownerEmail: session.email } }),
      bitcoinPrisma.gmailConnection.deleteMany({ where: { email: session.email } }),
    ]);
    const response = NextResponse.json({ ok: true, deleted: true });
    response.cookies.delete("corleon_stocks_session");
    return response;
  } catch (error) {
    console.error("Stock Intelligence disconnect failed", error);
    return NextResponse.json({ error: "Could not disconnect this mailbox right now." }, { status: 500 });
  }
}
