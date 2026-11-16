import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { handleStripeWebhook } from '../../../../../../src/cashflow/stripe-webhook.js';
import { prisma } from '../../../../lib/prisma';
import { syncStripeInvoice } from '../../../../lib/billing/invoices';
import { getStripe } from '../../../../lib/billing/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (!signature || !secret) return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 400 });
  if (declaredLength > 1_048_576) return NextResponse.json({ error: 'Payload too large.' }, { status: 413 });
  const rawBody = Buffer.from(await request.arrayBuffer());
  if (rawBody.byteLength > 1_048_576) return NextResponse.json({ error: 'Payload too large.' }, { status: 413 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: 'Invalid Stripe webhook signature.' }, { status: 400 });
  }

  try {
    // Preserve the existing cash-flow webhook pipeline while extending it for invoice synchronization.
    await handleStripeWebhook(rawBody, signature);
    await prisma.stripeWebhookReceipt.create({
      data: { eventId: event.id, eventType: event.type, livemode: event.livemode },
    }).catch((error: unknown) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return;
      throw error;
    });
    if (event.type.startsWith('invoice.')) {
      await syncStripeInvoice(event.data.object as Stripe.Invoice);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing failed', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
