import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { handleStripeWebhook } from '../../../../../../src/cashflow/stripe-webhook.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing stripe-signature.' }, { status: 400 });

  try {
    const rawBody = Buffer.from(await request.arrayBuffer());
    if (rawBody.byteLength > 1_048_576) return NextResponse.json({ error: 'Webhook payload too large.' }, { status: 413 });
    const result = await handleStripeWebhook(rawBody, signature);
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      return NextResponse.json({ error: 'Invalid Stripe webhook signature.' }, { status: 400 });
    }
    console.error('Stripe webhook processing failed', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
