import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { requireTaskOS } from '@/lib/taskos/security';
import { db } from '@/lib/taskos/db';
const schema = z.object({ priceId: z.string().min(1), successUrl: z.string().url(), cancelUrl: z.string().url() });
export async function POST(request: Request) {
  try {
    const { tenantId } = requireTaskOS(request), body = schema.parse(await request.json());
    const allowed = (process.env.STRIPE_ALLOWED_PRICE_IDS ?? '').split(',').filter(Boolean);
    if (!allowed.includes(body.priceId)) return NextResponse.json({ error: 'Price is not allowlisted' }, { status: 400 });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    let customer = await db.stripeCustomer.findUnique({ where: { tenantId } });
    if (!customer) {
      const created = await stripe.customers.create({ metadata: { tenantId } }, { idempotencyKey: 'taskos-customer-' + tenantId });
      customer = await db.stripeCustomer.create({ data: { tenantId, stripeCustomerId: created.id } });
    }
    const session = await stripe.checkout.sessions.create({ mode: 'subscription', customer: customer.stripeCustomerId, line_items: [{ price: body.priceId, quantity: 1 }], success_url: body.successUrl, cancel_url: body.cancelUrl, client_reference_id: tenantId, subscription_data: { metadata: { tenantId } } }, { idempotencyKey: 'taskos-checkout-' + tenantId + '-' + body.priceId + '-' + Math.floor(Date.now()/60000) });
    return NextResponse.json({ url: session.url });
  } catch (e) { return NextResponse.json({ error: e instanceof z.ZodError ? e.flatten() : 'Checkout failed' }, { status: e instanceof z.ZodError ? 400 : 401 }); }
}
