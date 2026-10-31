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

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
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
      if (event.event === 'payment.captured' || event.event === 'order.paid') {
        if (paymentEntity && (paymentEntity.amount !== payment.amount || paymentEntity.currency !== payment.currency)) {
          throw new Error('Webhook amount or currency mismatch.');
        }
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'CAPTURED',
            providerPaymentId: paymentEntity?.id || payment.providerPaymentId,
            capturedAt: new Date(),
          },
        });
      } else if (event.event === 'payment.failed' && payment.status !== 'CAPTURED') {
        await tx.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', providerPaymentId: paymentEntity?.id } });
      }
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) return NextResponse.json({ received: true, duplicate: true });
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
