import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const [stores, wallets, totals, recentEntries] = await Promise.all([
    db.currencyStore.findMany({ where: { ownerUserId: session.userId }, orderBy: { createdAt: "desc" } }),
    db.currencyWallet.findMany({
      where: { ownerUserId: session.userId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, customerEmail: true, customerName: true, status: true, createdAt: true },
    }),
    db.currencyLedgerEntry.groupBy({
      by: ["walletId"],
      where: { ownerUserId: session.userId },
      _sum: { amount: true },
    }),
    db.currencyLedgerEntry.findMany({
      where: { ownerUserId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { store: { select: { name: true } }, wallet: { select: { customerEmail: true, customerName: true } } },
    }),
  ]);

  const balances = new Map(totals.map((row) => [row.walletId, row._sum.amount ?? 0]));
  const customerWallets = wallets.map((wallet) => ({ ...wallet, balance: balances.get(wallet.id) ?? 0 }));
  return NextResponse.json({
    currency: { name: "Corleon", code: "CRL", settlementCurrency: "INR", model: "CLOSED_LOOP_CREDITS" },
    stores,
    wallets: customerWallets,
    recentEntries,
    totals: {
      customers: wallets.length,
      issued: recentEntries.length,
      outstandingCredits: customerWallets.reduce((sum, wallet) => sum + wallet.balance, 0),
    },
    safeguards: {
      cashRedemption: false,
      peerToPeerTransfers: false,
      externalExchange: false,
      blockchainTransfer: false,
      inrPegOrConversion: false,
      livePaymentCollection: false,
    },
  });
}
