import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeCustomerEmail, parseCreditAmount } from "@/lib/currency/policy";

export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["ISSUE", "REDEEM"]),
  storeId: z.string().min(1).max(64),
  customerEmail: z.string().email().max(254),
  customerName: z.string().trim().max(100).optional(),
  amount: z.number().int().positive().max(1_000_000),
  reason: z.string().trim().min(3).max(240),
  orderReference: z.string().trim().max(100).optional(),
  idempotencyKey: z.string().min(8).max(120),
});

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parseCreditAmount(parsed.data?.amount) === null) {
    return NextResponse.json({ error: "Invalid credit transaction" }, { status: 400 });
  }
  const input = parsed.data;
  const email = normalizeCustomerEmail(input.customerEmail);
  const signedAmount = input.action === "ISSUE" ? input.amount : -input.amount;
  const idempotencyKey = `${session.userId}:${input.idempotencyKey}`;
  const fingerprint = JSON.stringify({ action: input.action, storeId: input.storeId, email, amount: input.amount, orderReference: input.orderReference ?? null });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await db.$transaction(async (tx) => {
        const prior = await tx.currencyLedgerEntry.findUnique({ where: { idempotencyKey } });
        if (prior) {
          const metadata = prior.metadata as { fingerprint?: string } | null;
          if (prior.ownerUserId !== session.userId || metadata?.fingerprint !== fingerprint) {
            throw new Error("IDEMPOTENCY_CONFLICT");
          }
          return { entry: prior, replayed: true };
        }

        const store = await tx.currencyStore.findFirst({
          where: { id: input.storeId, ownerUserId: session.userId, status: "ACTIVE" },
          select: { id: true },
        });
        if (!store) throw new Error("STORE_NOT_FOUND");

        let wallet = await tx.currencyWallet.findUnique({
          where: { ownerUserId_customerEmail: { ownerUserId: session.userId, customerEmail: email } },
        });
        if (!wallet && input.action === "REDEEM") throw new Error("WALLET_NOT_FOUND");
        if (!wallet) {
          wallet = await tx.currencyWallet.create({
            data: { ownerUserId: session.userId, customerEmail: email, customerName: input.customerName || null },
          });
        }
        if (wallet.status !== "ACTIVE") throw new Error("WALLET_NOT_ACTIVE");

        const balance = await tx.currencyLedgerEntry.aggregate({
          where: { ownerUserId: session.userId, walletId: wallet.id },
          _sum: { amount: true },
        });
        const available = balance._sum.amount ?? 0;
        if (input.action === "REDEEM" && available < input.amount) throw new Error("INSUFFICIENT_CREDITS");

        const entry = await tx.currencyLedgerEntry.create({
          data: {
            ownerUserId: session.userId,
            walletId: wallet.id,
            storeId: store.id,
            type: input.action,
            amount: signedAmount,
            reason: input.reason,
            orderReference: input.orderReference,
            idempotencyKey,
            metadata: { fingerprint, settlementCurrency: "INR", cashValue: false },
          },
        });
        await tx.auditEvent.create({
          data: {
            userId: session.userId,
            actorType: "USER",
            action: input.action === "ISSUE" ? "CORLEON_CREDITS_ISSUED" : "CORLEON_CREDITS_REDEEMED",
            resource: "CurrencyLedgerEntry",
            resourceId: entry.id,
            outcome: "SUCCESS",
            metadata: { storeId: store.id, walletId: wallet.id, amount: input.amount, currency: "CRL" },
          },
        });
        return { entry, replayed: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      return NextResponse.json({ ...result, currency: "CRL" }, { status: result.replayed ? 200 : 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN";
      if (message === "IDEMPOTENCY_CONFLICT") return NextResponse.json({ error: "Idempotency key was already used for a different transaction" }, { status: 409 });
      if (message === "STORE_NOT_FOUND") return NextResponse.json({ error: "Store not found or inactive" }, { status: 404 });
      if (message === "WALLET_NOT_FOUND") return NextResponse.json({ error: "Customer wallet does not exist; issue credits before redemption" }, { status: 404 });
      if (message === "WALLET_NOT_ACTIVE") return NextResponse.json({ error: "Customer wallet is not active" }, { status: 409 });
      if (message === "INSUFFICIENT_CREDITS") return NextResponse.json({ error: "Insufficient Corleon credits" }, { status: 409 });
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Duplicate transaction; retry with the same idempotency key" }, { status: 409 });
      return NextResponse.json({ error: "Unable to process credit transaction" }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "Transaction conflict; retry the request" }, { status: 409 });
}
