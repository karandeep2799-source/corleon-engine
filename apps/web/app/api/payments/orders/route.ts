import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { assertSameOrigin, getPaymentActor } from '@/lib/payments/auth';
import { validateAmount, safeIdempotencyKey } from '@/lib/payments/domain';
import { prisma } from '@/lib/payments/prisma';
import { createRazorpayOrder } from '@/lib/payments/razorpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const actor = getPaymentActor(request);
  if (!actor) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (!assertSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });

  try {
    const body = await request.json() as { amount?: unknown; description?: unknown; idempotencyKey?: unknown };
    const amount = validateAmount(body.amount);
    const idempotencyKey = safeIdempotencyKey(body.idempotencyKey);
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 120) : 'Corleon checkout';

    const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.userId !== actor.userId || existing.amount !== amount) {
        return NextResponse.json({ error: 'Idempotency key conflict.' }, { status: 409 });
      }
      return NextResponse.json({
        paymentId: existing.id, orderId: existing.providerOrderId,
        amount: existing.amount, currency: existing.currency,
        keyId: process.env.RAZORPAY_KEY_ID, status: existing.status,
      });
    }

    const paymentId = randomUUID();
    const order = await createRazorpayOrder({
      amount, currency: 'INR', receipt: paymentId.replaceAll('-', '').slice(0, 40),
      notes: { corleonPaymentId: paymentId, userId: actor.userId, description },
    });

    const payment = await prisma.payment.create({
      data: {
        id: paymentId, userId: actor.userId, provider: 'RAZORPAY',
        providerOrderId: order.id, amount, currency: 'INR',
        idempotencyKey, status: 'CREATED', description,
      },
    });

    return NextResponse.json({
      paymentId: payment.id, orderId: order.id, amount: payment.amount,
      currency: payment.currency, keyId: order.keyId, status: payment.status,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create payment.';
    const status = message.startsWith('Amount') || message.startsWith('A valid') ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
