import { NextRequest, NextResponse } from "next/server";
import { bitcoinPrisma } from "@/lib/bitcoin/prisma";
import { decryptRefreshToken, getStockSession, isSameOrigin } from "@/lib/stocks/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getStockSession();
  if (!session) return NextResponse.json({ error: "Not connected." }, { status: 401 });
  let googleRevoked = false;
  try {
    const connection = await bitcoinPrisma.gmailConnection.findUnique({ where: { email: session.email } });
    if (connection) {
      try {
        const refreshToken = decryptRefreshToken(connection.refreshTokenEncrypted);
        const response = await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: refreshToken }),
          cache: "no-store",
        });
        googleRevoked = response.ok;
      } catch {
        console.warn("Could not revoke the Google token during local disconnect.");
      }
    }
    await bitcoinPrisma.$transaction([
      bitcoinPrisma.stockTransaction.deleteMany({ where: { ownerEmail: session.email } }),
      bitcoinPrisma.stockEmailEvidence.deleteMany({ where: { ownerEmail: session.email } }),
      bitcoinPrisma.stockSyncState.deleteMany({ where: { ownerEmail: session.email } }),
      bitcoinPrisma.gmailConnection.deleteMany({ where: { email: session.email } }),
    ]);
    const response = NextResponse.json({ ok: true, deleted: true, googleRevoked });
    response.cookies.delete("corleon_stocks_session");
    return response;
  } catch (error) {
    console.error("Stock Intelligence disconnect failed", error);
    return NextResponse.json({ error: "Could not disconnect this mailbox right now." }, { status: 500 });
  }
}
