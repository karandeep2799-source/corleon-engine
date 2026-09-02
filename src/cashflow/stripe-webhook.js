import Stripe from 'stripe';
import { prisma } from './prisma.js';
import { recordBillingEvent, reverseCommission } from './engine.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function centsToDecimal(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function organizationIdFor(object) {
  return object?.metadata?.organizationId || object?.subscription_details?.metadata?.organizationId || null;
}

export async function handleStripeWebhook(rawBody, signature) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET is required');
  const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  const object = event.data.object;
  const organizationId = organizationIdFor(object);
  if (!organizationId) throw new Error('Missing metadata.organizationId on Stripe event');

  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_externalId: { provider: 'stripe', externalId: event.id } }
  });
  if (existing?.status === 'PROCESSED') return { duplicate: true, eventId: event.id };

  await prisma.webhookEvent.upsert({
    where: { provider_externalId: { provider: 'stripe', externalId: event.id } },
    create: { organizationId, provider: 'stripe', externalId: event.id, eventType: event.type, payload: event, status: 'PROCESSING' },
    update: { status: 'PROCESSING', payload: event }
  });

  try {
    let result = null;
    const customerExternalId = String(object.customer || object.metadata?.customerId || `stripe:${event.id}`);
    const customerEmail = object.customer_email || object.receipt_email || object.metadata?.customerEmail || null;
    const subscriptionExternalId = object.subscription ? String(object.subscription) : null;
    const orderExternalId = object.metadata?.orderId ? String(object.metadata.orderId) : `stripe:${event.id}`;

    if (event.type === 'payment_intent.succeeded') {
      result = await recordBillingEvent({
        organizationId,
        provider: 'stripe',
        externalId: event.id,
        type: 'PAYMENT',
        customerExternalId,
        customerEmail,
        orderExternalId,
        amount: centsToDecimal(object.amount_received || object.amount),
        currency: String(object.currency).toUpperCase(),
        occurredAt: new Date(event.created * 1000),
        rawPayload: event
      });
    } else if (event.type === 'invoice.paid') {
      const type = object.billing_reason === 'subscription_create' ? 'SUBSCRIPTION_STARTED' : 'SUBSCRIPTION_RENEWED';
      result = await recordBillingEvent({
        organizationId,
        provider: 'stripe',
        externalId: event.id,
        type,
        customerExternalId,
        customerEmail,
        orderExternalId,
        subscriptionExternalId,
        amount: centsToDecimal(object.amount_paid),
        currency: String(object.currency).toUpperCase(),
        occurredAt: new Date(event.created * 1000),
        rawPayload: event
      });
    } else if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
      const order = await prisma.order.findFirst({ where: { organizationId, provider: 'stripe', externalId: orderExternalId } });
      if (order) {
        const commissions = await prisma.commission.findMany({ where: { orderId: order.id, status: { in: ['PENDING', 'APPROVED', 'AVAILABLE', 'PAID'] } } });
        for (const commission of commissions) {
          await reverseCommission(commission.id, event.type === 'charge.refunded' ? 'Stripe refund' : 'Stripe dispute');
        }
      }
      result = { reversed: true };
    }

    await prisma.webhookEvent.update({ where: { id: (await prisma.webhookEvent.findUnique({ where: { provider_externalId: { provider: 'stripe', externalId: event.id } } })).id }, data: { status: 'PROCESSED', processedAt: new Date() } });
    return { eventId: event.id, result };
  } catch (error) {
    await prisma.webhookEvent.updateMany({ where: { provider: 'stripe', externalId: event.id }, data: { status: 'FAILED', errorMessage: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}
