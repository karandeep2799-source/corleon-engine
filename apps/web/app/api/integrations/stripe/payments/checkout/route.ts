import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { requireTaskOS } from '@/lib/taskos/security';
import { db } from '@/lib/taskos/db';

const schema = z.object({ priceId: z.string().min(1), successUrl: z.string().url(), cancelUrl: z.string().url() });

export async function POST(request: Request) {
  try {
    const { tenantId } = requireTaskOS(request);
    const body = schema.parse(await request.json());
    const allowed = (process.env.STRIPE_ALLOWED_PAYMENT_PRICE_IDS ?? '').split(',').filter(Boolean);
    const origin = new URL(process.env.APP_URL!).origin;
    if (!allowed.includes(body.priceId)) return NextResponse.json({ error: 'Payment price is not allowlisted' }, { status: 400 });
    if (new URL(body.successUrl).origin !== origin || new URL(body.cancelUrl).origin !== origin) return NextResponse.json({ error: 'Redirect URLs must use the configured application origin' }, { status: 400 });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    let customer = await db.stripeCustomer.findUnique({ where: { tenantId } });
    if (!customer) {
      const created = await stripe.customers.create({ metadata: { tenantId } }, { idempotencyKey: 'taskos-customer-' + tenantId });
      customer = await db.stripeCustomer.upsert({ where: { tenantId }, create: { tenantId, stripeCustomerId: created.id }, update: {} });
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customer.stripeCustomerId,
      line_items: [{ price: body.priceId, quantity: 1 }],
      success_url: body.successUrl,
      cancel_url: body.cancelUrl,
      client_reference_id: tenantId,
      metadata: { tenantId },
      payment_intent_data: { metadata: { tenantId } }
    }, { idempotencyKey: 'taskos-payment-' + tenantId + '-' + body.priceId + '-' + Math.floor(Date.now()/60000) });
    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? error.flatten() : 'Payment checkout failed' }, { status: error instanceof z.ZodError ? 400 : 401 });
  }
}
