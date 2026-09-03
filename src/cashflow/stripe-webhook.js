import Stripe from 'stripe';
import { prisma } from './prisma.js';
import { recordBillingEvent, reverseCommission } from './engine.js';

function centsToDecimal(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function organizationIdFor(object) {
  return object?.metadata?.organizationId
    || object?.subscription_details?.metadata?.organizationId
    || object?.parent?.metadata?.organizationId
    || null;
}

function isSupportedEvent(type) {
  return type === 'payment_intent.succeeded'
    || type === 'invoice.paid'
    || type === 'charge.refunded'
    || type === 'charge.dispute.created';
}

export async function handleStripeWebhook(rawBody, signature) {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is required');
  if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET is required');
  if (!signature) throw new Error('Missing stripe-signature');

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  const object = event.data.object;

  // Acknowledge unrelated Stripe events instead of creating an invalid WebhookEvent row.
  if (!isSupportedEvent(event.type)) {
    return { eventId: event.id, ignored: true };
  }

  let organizationId = organizationIdFor(object);

  // Refund/dispute payloads do not reliably carry the original metadata.
  // Recover the organization from the Corleon order when possible.
  if (!organizationId && (event.type === 'charge.refunded' || event.type === 'charge.dispute.created')) {
    const paymentIntentId = object.payment_intent ? String(object.payment_intent) : null;
    if (paymentIntentId) {
      const order = await prisma.order.findFirst({
        where: { externalId: `stripe:pi:${paymentIntentId}` },
        select: { organizationId: true }
      });
      organizationId = order?.organizationId || null;
    }
  }

  if (!organizationId) throw new Error('Missing metadata.organizationId for supported Stripe event');

  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_externalId: { provider: 'stripe', externalId: event.id } }
  });
  if (existing?.status === 'PROCESSED') return { duplicate: true, eventId: event.id };

  const webhook = await prisma.webhookEvent.upsert({
    where: { provider_externalId: { provider: 'stripe', externalId: event.id } },
    create: {
      organizationId,
      provider: 'stripe',
      externalId: event.id,
      eventType: event.type,
      payload: event,
      status: 'PROCESSING'
    },
    update: {
      organizationId,
      status: 'PROCESSING',
      payload: event,
      errorMessage: null
    }
  });

  try {
    let result = null;
    const customerExternalId = String(object.customer || object.metadata?.customerId || `stripe:${event.id}`);
    const customerEmail = object.customer_email || object.receipt_email || object.metadata?.customerEmail || null;
    const subscriptionExternalId = object.subscription ? String(object.subscription) : null;

    if (event.type === 'payment_intent.succeeded') {
      const orderExternalId = object.metadata?.orderId
        ? String(object.metadata.orderId)
        : `stripe:pi:${object.id}`;

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
      const orderExternalId = object.metadata?.orderId
        ? String(object.metadata.orderId)
        : `stripe:invoice:${object.id}`;
      const type = object.billing_reason === 'subscription_create'
        ? 'SUBSCRIPTION_STARTED'
        : 'SUBSCRIPTION_RENEWED';

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
      const paymentIntentId = object.payment_intent ? String(object.payment_intent) : null;
      const orderExternalId = object.metadata?.orderId
        ? String(object.metadata.orderId)
        : paymentIntentId
          ? `stripe:pi:${paymentIntentId}`
          : null;

      const order = orderExternalId
        ? await prisma.order.findFirst({ where: { organizationId, externalId: orderExternalId } })
        : null;

      if (order) {
        const commissions = await prisma.commission.findMany({
          where: {
            orderId: order.id,
            status: { in: ['PENDING', 'APPROVED', 'AVAILABLE', 'PAID'] }
          }
        });

        for (const commission of commissions) {
          await reverseCommission(
            commission.id,
            event.type === 'charge.refunded' ? 'Stripe refund' : 'Stripe dispute'
          );
        }
      }

      result = { reversed: Boolean(order) };
    }

    await prisma.webhookEvent.update({
      where: { id: webhook.id },
      data: { status: 'PROCESSED', processedAt: new Date(), errorMessage: null }
    });

    return { eventId: event.id, result };
  } catch (error) {
    await prisma.webhookEvent.update({
      where: { id: webhook.id },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    });
    throw error;
  }
}
