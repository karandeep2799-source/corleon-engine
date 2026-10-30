import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/taskos/db';

export const runtime = 'nodejs';

function stripeId(value: string | Stripe.Customer | Stripe.DeletedCustomer | Stripe.PaymentIntent | Stripe.Subscription | null): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 });
  }
  const raw = await request.text();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const existing = await db.stripeWebhookEvent.findUnique({ where: { stripeEventId: event.id } });
  if (existing?.processedAt) return NextResponse.json({ received: true, duplicate: true });
  await db.stripeWebhookEvent.upsert({
    where: { stripeEventId: event.id },
    create: { stripeEventId: event.id, type: event.type, payload: JSON.parse(JSON.stringify(event)) },
    update: {}
  });

  if (event.type.startsWith('customer.subscription.')) {
    const sub = event.data.object as Stripe.Subscription;
    const tenantId = sub.metadata.tenantId;
    const customer = tenantId ? await db.stripeCustomer.findUnique({ where: { tenantId } }) : null;
    if (customer) {
      const priceId = sub.items.data[0]?.price.id ?? 'unknown';
      const status = ({ active: 'ACTIVE', trialing: 'TRIALING', past_due: 'PAST_DUE', canceled: 'CANCELED', unpaid: 'UNPAID', incomplete: 'INCOMPLETE' } as Record<string,string>)[sub.status] ?? 'INCOMPLETE';
      await db.stripeSubscription.upsert({
        where: { stripeSubscriptionId: sub.id },
        create: { tenantId, customerId: customer.id, stripeSubscriptionId: sub.id, stripePriceId: priceId, status: status as never, currentPeriodEnd: new Date(sub.current_period_end * 1000), cancelAtPeriodEnd: sub.cancel_at_period_end },
        update: { stripePriceId: priceId, status: status as never, currentPeriodEnd: new Date(sub.current_period_end * 1000), cancelAtPeriodEnd: sub.cancel_at_period_end }
      });
    }
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode === 'payment') {
      const tenantId = session.metadata?.tenantId ?? session.client_reference_id;
      const customerId = stripeId(session.customer as Stripe.Customer | string | null);
      const customer = tenantId ? await db.stripeCustomer.findUnique({ where: { tenantId } }) : customerId ? await db.stripeCustomer.findUnique({ where: { stripeCustomerId: customerId } }) : null;
      if (customer) {
        const paymentIntentId = stripeId(session.payment_intent as Stripe.PaymentIntent | string | null);
        await db.stripePayment.upsert({
          where: { stripeCheckoutSessionId: session.id },
          create: { tenantId: customer.tenantId, customerId: customer.id, stripeCheckoutSessionId: session.id, stripePaymentIntentId: paymentIntentId, amount: session.amount_total, currency: session.currency, status: session.payment_status === 'paid' ? 'SUCCEEDED' : 'PENDING', metadata: { paymentStatus: session.payment_status } },
          update: { stripePaymentIntentId: paymentIntentId, amount: session.amount_total, currency: session.currency, status: session.payment_status === 'paid' ? 'SUCCEEDED' : 'PENDING' }
        });
      }
    }
  }

  if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as Stripe.PaymentIntent;
    await db.stripePayment.updateMany({
      where: { stripePaymentIntentId: intent.id },
      data: { status: event.type === 'payment_intent.succeeded' ? 'SUCCEEDED' : 'FAILED' }
    });
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    const intentId = stripeId(charge.payment_intent as Stripe.PaymentIntent | string | null);
    if (intentId) await db.stripePayment.updateMany({ where: { stripePaymentIntentId: intentId }, data: { status: 'REFUNDED' } });
  }

  await db.stripeWebhookEvent.update({ where: { stripeEventId: event.id }, data: { processedAt: new Date() } });
  return NextResponse.json({ received: true });
}
