import { NextRequest, NextResponse } from 'next/server';
import { handleStripeWebhook } from '../../../../../../src/cashflow/stripe-webhook.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  try {
    const rawBody = Buffer.from(await request.arrayBuffer());
    const result = await handleStripeWebhook(rawBody, signature);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Stripe webhook failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 400 },
    );
  }
}
