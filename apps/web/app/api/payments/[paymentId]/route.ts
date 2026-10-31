import { NextRequest, NextResponse } from 'next/server';
import { getPaymentActor } from '@/lib/payments/auth';
import { prisma } from '@/lib/payments/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ paymentId: string }> }) {
  const actor = getPaymentActor(request);
  if (!actor) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const { paymentId } = await context.params;
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId: actor.userId },
    select: { id: true, status: true, amount: true, currency: true, createdAt: true, capturedAt: true },
  });
  if (!payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
  return NextResponse.json(payment);
}
