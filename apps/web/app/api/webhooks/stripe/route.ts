import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { handleStripeWebhook } from '../../../../../../src/cashflow/stripe-webhook.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function readBoundedBody(request: NextRequest, maxBytes = 1_048_576): Promise<Buffer | null> {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > maxBytes || !request.body) return null;
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
  return Buffer.concat(chunks);
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing stripe-signature.' }, { status: 400 });
  const rawBody = await readBoundedBody(request);
  if (!rawBody) return NextResponse.json({ error: 'Webhook payload is missing or too large.' }, { status: 413 });

  try {
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
