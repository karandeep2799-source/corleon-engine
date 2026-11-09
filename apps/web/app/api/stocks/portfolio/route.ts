import { NextResponse } from "next/server";
import { bitcoinPrisma } from "@/lib/bitcoin/prisma";
import { getStockSession } from "@/lib/stocks/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildPositions(transactions: Array<{ symbol: string; companyName: string | null; currency: string; type: string; quantity: unknown; price: unknown; executedAt: Date }>) {
  const groups = new Map<string, { symbol: string; companyName: string | null; currency: string; quantity: number; costBasis: number; realizedPnl: number }>();
  for (const item of [...transactions].sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime())) {
    const key = `${item.currency}:${item.symbol}`;
    const position = groups.get(key) ?? { symbol: item.symbol, companyName: item.companyName, currency: item.currency, quantity: 0, costBasis: 0, realizedPnl: 0 };
    const quantity = Number(item.quantity);
    const price = Number(item.price);
    if (!Number.isFinite(quantity) || !Number.isFinite(price)) continue;
    if (item.type === "BUY") { position.quantity += quantity; position.costBasis += quantity * price; }
    if (item.type === "SELL" && position.quantity > 0) {
      const sold = Math.min(quantity, position.quantity);
      const averageCost = position.costBasis / position.quantity;
      position.realizedPnl += (price - averageCost) * sold;
      position.costBasis -= averageCost * sold;
      position.quantity -= sold;
    }
    groups.set(key, position);
  }
  return [...groups.values()].filter((position) => position.quantity > 0.00000001).map((position) => ({
    ...position, averageCost: position.quantity > 0 ? position.costBasis / position.quantity : 0,
  })).sort((a, b) => b.costBasis - a.costBasis);
}

export async function GET() {
  const session = await getStockSession();
  if (!session) return NextResponse.json({ connected: false, holdings: [], transactions: [], sources: [] }, { headers: { "Cache-Control": "no-store" } });
  try {
    const [connection, transactions, confirmedTransactions, sources, syncState, pendingCount] = await Promise.all([
      bitcoinPrisma.gmailConnection.findUnique({ where: { email: session.email }, select: { email: true, displayName: true, picture: true, connectedAt: true } }),
      bitcoinPrisma.stockTransaction.findMany({
        where: { ownerEmail: session.email, reviewStatus: { not: "IGNORED" } },
        include: { evidence: { select: { gmailMessageId: true, subject: true, sender: true, receivedAt: true } } },
        orderBy: { executedAt: "desc" }, take: 250,
      }),
      bitcoinPrisma.stockTransaction.findMany({
        where: { ownerEmail: session.email, reviewStatus: "CONFIRMED" },
        select: { symbol: true, companyName: true, currency: true, type: true, quantity: true, price: true, executedAt: true },
        orderBy: { executedAt: "asc" },
      }),
      bitcoinPrisma.stockEmailEvidence.findMany({ where: { ownerEmail: session.email }, orderBy: { receivedAt: "desc" }, take: 40 }),
      bitcoinPrisma.stockSyncState.findUnique({ where: { ownerEmail: session.email } }),
      bitcoinPrisma.stockTransaction.count({ where: { ownerEmail: session.email, reviewStatus: "NEEDS_REVIEW" } }),
    ]);
    if (!connection) return NextResponse.json({ connected: false, holdings: [], transactions: [], sources: [] }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({
      connected: true,
      account: { email: connection.email, name: connection.displayName, picture: connection.picture, connectedAt: connection.connectedAt },
      summary: {
        holdingsCount: buildPositions(confirmedTransactions).length,
        pendingReview: pendingCount,
        confirmedTransactions: confirmedTransactions.length,
        scannedEmails: syncState?.scannedCount ?? 0,
        lastSyncedAt: syncState?.lastSyncedAt ?? null,
        scanComplete: syncState?.scanComplete ?? false,
      },
      holdings: buildPositions(confirmedTransactions),
      transactions: transactions.map((item) => ({
        id: item.id, symbol: item.symbol, companyName: item.companyName, type: item.type,
        quantity: item.quantity.toString(), price: item.price.toString(), amount: item.amount?.toString() ?? null,
        currency: item.currency, executedAt: item.executedAt, confidence: item.confidence,
        reviewStatus: item.reviewStatus, evidenceExcerpt: item.evidenceExcerpt,
        sourceSubject: item.evidence.subject, sourceSender: item.evidence.sender,
        sourceUrl: `https://mail.google.com/mail/u/0/#all/${item.evidence.gmailMessageId}`,
      })),
      sources: sources.map((item) => ({
        id: item.id, subject: item.subject, sender: item.sender, receivedAt: item.receivedAt,
        hasFinancialData: item.hasFinancialData, attachments: Array.isArray(item.attachmentNames) ? item.attachmentNames : [],
        sourceUrl: `https://mail.google.com/mail/u/0/#all/${item.gmailMessageId}`,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Stock Intelligence portfolio load failed", error);
    return NextResponse.json({ error: "Portfolio data is not available. Check the database and migration setup." }, { status: 503 });
  }
}
