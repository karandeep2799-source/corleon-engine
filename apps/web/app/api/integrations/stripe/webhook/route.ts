import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/taskos/db';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 });
  const raw = await request.text(), stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(raw, signature, process.env.STRIPE_WEBHOOK_SECRET); }
  catch { return NextResponse.json({ error: 'Invalid signature' }, { status: 400 }); }
  const existing = await db.stripeWebhookEvent.findUnique({ where: { stripeEventId: event.id } });
  if (existing?.processedAt) return NextResponse.json({ received: true, duplicate: true });
  await db.stripeWebhookEvent.upsert({ where: { stripeEventId: event.id }, create: { stripeEventId: event.id, type: event.type, payload: JSON.parse(JSON.stringify(event)) }, update: {} });
  if (event.type.startsWith('customer.subscription.')) {
    const sub = event.data.object as Stripe.Subscription, tenantId = sub.metadata.tenantId;
    const customer = await db.stripeCustomer.findUnique({ where: { tenantId } });
    if (customer) {
      const priceId = sub.items.data[0]?.price.id ?? 'unknown';
      const status = ({ active: 'ACTIVE', trialing: 'TRIALING', past_due: 'PAST_DUE', canceled: 'CANCELED', unpaid: 'UNPAID', incomplete: 'INCOMPLETE' } as Record<string,string>)[sub.status] ?? 'INCOMPLETE';
      await db.stripeSubscription.upsert({ where: { stripeSubscriptionId: sub.id }, create: { tenantId, customerId: customer.id, stripeSubscriptionId: sub.id, stripePriceId: priceId, status: status as never, currentPeriodEnd: new Date(sub.current_period_end * 1000), cancelAtPeriodEnd: sub.cancel_at_period_end }, update: { stripePriceId: priceId, status: status as never, currentPeriodEnd: new Date(sub.current_period_end * 1000), cancelAtPeriodEnd: sub.cancel_at_period_end } });
    }
  }
  await db.stripeWebhookEvent.update({ where: { stripeEventId: event.id }, data: { processedAt: new Date() } });
  return NextResponse.json({ received: true });
}
