import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { assertSameOrigin, getPaymentActor } from '@/lib/payments/auth';
import { safeIdempotencyKey } from '@/lib/payments/domain';
import { prisma } from '@/lib/payments/prisma';
import { createRazorpayOrder } from '@/lib/payments/razorpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const actor = getPaymentActor(request);
  if (!actor) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (!assertSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });

  let paymentId: string | undefined;
  try {
    const body = await request.json() as { quoteId?: unknown; idempotencyKey?: unknown };
    if (typeof body.quoteId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.quoteId)) {
      return NextResponse.json({ error: 'A valid server-issued quoteId is required.' }, { status: 400 });
    }
    const idempotencyKey = safeIdempotencyKey(body.idempotencyKey);
    const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.userId !== actor.userId || existing.quoteId !== body.quoteId) {
        return NextResponse.json({ error: 'Idempotency key conflict.' }, { status: 409 });
      }
      if (!existing.providerOrderId) return NextResponse.json({ error: 'This checkout request is already being processed or failed. Start a new checkout.' }, { status: 409 });
      return NextResponse.json({
        paymentId: existing.id, orderId: existing.providerOrderId,
        amount: existing.amount, currency: existing.currency,
        keyId: process.env.RAZORPAY_KEY_ID, status: existing.status,
      });
    }

    const quote = await prisma.paymentQuote.findFirst({
      where: { id: body.quoteId, userId: actor.userId, consumedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!quote) return NextResponse.json({ error: 'Checkout quote is invalid, expired, or already used.' }, { status: 409 });

    paymentId = randomUUID();
    const reservation = await prisma.payment.create({
      data: {
        id: paymentId, userId: actor.userId, quoteId: quote.id, provider: 'RAZORPAY',
        providerOrderId: null, amount: quote.amount, currency: quote.currency,
        idempotencyKey, status: 'PROCESSING', description: quote.description,
      },
    });

    const order = await createRazorpayOrder({
      amount: quote.amount, currency: 'INR', receipt: paymentId.replaceAll('-', '').slice(0, 40),
      notes: { corleonPaymentId: paymentId, quoteId: quote.id, userId: actor.userId, description: quote.description },
    });

    const payment = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: reservation.id },
        data: { providerOrderId: order.id, status: 'CREATED' },
      });
      await tx.paymentQuote.update({ where: { id: quote.id }, data: { consumedAt: new Date() } });
      return updated;
    });

    return NextResponse.json({
      paymentId: payment.id, orderId: order.id, amount: payment.amount,
      currency: payment.currency, keyId: order.keyId, status: payment.status,
    }, { status: 201 });
  } catch (error) {
    if (paymentId) {
      await prisma.payment.updateMany({ where: { id: paymentId, status: 'PROCESSING' }, data: { status: 'FAILED' } }).catch(() => undefined);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'This checkout request or quote is already being processed.' }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : 'Unable to create payment.';
    return NextResponse.json({ error: message.startsWith('A valid idempotencyKey') ? message : 'Unable to create payment.' }, { status: message.startsWith('A valid idempotencyKey') ? 400 : 502 });
  }
}
