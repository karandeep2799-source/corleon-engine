import { NextRequest, NextResponse } from 'next/server';
import {
  handleStripeWebhook,
  StripeWebhookConfigurationError,
  StripeWebhookSignatureError,
} from '../../../../../../src/cashflow/stripe-webhook.js';

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
    if (error instanceof StripeWebhookSignatureError) {
      return NextResponse.json({ error: 'Invalid Stripe webhook signature' }, { status: 400 });
    }
    if (error instanceof StripeWebhookConfigurationError) {
      console.error('Stripe webhook configuration is incomplete');
      return NextResponse.json({ error: 'Webhook endpoint is not configured' }, { status: 503 });
    }

    console.error('Stripe webhook processing failed', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json(
      { error: 'Webhook processing failed; Stripe may retry this event.' },
      { status: 500 },
    );
  }
}
