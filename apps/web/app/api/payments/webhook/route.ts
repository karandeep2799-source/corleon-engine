import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/payments/prisma';
import { verifyWebhookSignature } from '@/lib/payments/razorpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RazorpayWebhook = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string } };
    order?: { entity?: { id?: string } };
  };
};

async function readRawBody(request: NextRequest, maxBytes = 1_048_576): Promise<string | null> {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function POST(request: NextRequest) {
  const rawBody = await readRawBody(request);
  if (rawBody === null) return NextResponse.json({ error: 'Webhook body is missing or too large.' }, { status: 413 });
  const signature = request.headers.get('x-razorpay-signature') || '';
  const eventId = request.headers.get('x-razorpay-event-id');
  if (!signature || !eventId || eventId.length > 255) return NextResponse.json({ error: 'Invalid webhook headers.' }, { status: 400 });

  try {
    if (!verifyWebhookSignature(rawBody, signature)) return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
    const event = JSON.parse(rawBody) as RazorpayWebhook;
    const paymentEntity = event.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id || event.payload?.order?.entity?.id;
    if (!orderId) return NextResponse.json({ received: true });

    await prisma.$transaction(async (tx) => {
      await tx.paymentWebhookEvent.create({ data: { providerEventId: eventId, eventType: event.event || 'unknown' } });
      const payment = await tx.payment.findUnique({ where: { providerOrderId: orderId } });
      if (!payment) return;
      if (event.event === 'payment.captured' && paymentEntity) {
        if (paymentEntity.amount !== payment.amount || paymentEntity.currency !== payment.currency) {
          throw new Error('Webhook amount or currency mismatch.');
        }
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'CAPTURED',
            providerPaymentId: paymentEntity.id || payment.providerPaymentId,
            capturedAt: new Date(),
          },
        });
      } else if (event.event === 'payment.failed' && payment.status !== 'CAPTURED') {
        await tx.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', providerPaymentId: paymentEntity?.id } });
      }
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
