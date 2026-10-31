import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, getPaymentActor } from '@/lib/payments/auth';
import { prisma } from '@/lib/payments/prisma';
import { fetchRazorpayPayment, verifyCheckoutSignature } from '@/lib/payments/razorpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const actor = getPaymentActor(request);
  if (!actor) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (!assertSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });

  try {
    const body = await request.json() as { paymentId?: string; razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string };
    if (!body.paymentId || !body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment verification fields.' }, { status: 400 });
    }
    const payment = await prisma.payment.findFirst({
      where: { id: body.paymentId, userId: actor.userId, providerOrderId: body.razorpay_order_id },
    });
    if (!payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    if (!verifyCheckoutSignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)) {
      return NextResponse.json({ error: 'Invalid payment signature.' }, { status: 400 });
    }

    const providerPayment = await fetchRazorpayPayment(body.razorpay_payment_id);
    if (providerPayment.order_id !== payment.providerOrderId || providerPayment.amount !== payment.amount || providerPayment.currency !== payment.currency) {
      return NextResponse.json({ error: 'Payment details do not match the order.' }, { status: 409 });
    }
    const status = providerPayment.status === 'captured' ? 'CAPTURED' : providerPayment.status === 'authorized' ? 'AUTHORIZED' : providerPayment.status === 'failed' ? 'FAILED' : payment.status;
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { providerPaymentId: providerPayment.id, status, ...(status === 'CAPTURED' ? { capturedAt: new Date() } : {}) },
    });
    return NextResponse.json({ paymentId: updated.id, status: updated.status });
  } catch {
    return NextResponse.json({ error: 'Payment verification could not be completed.' }, { status: 502 });
  }
}
