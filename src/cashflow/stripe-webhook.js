import Stripe from 'stripe';
import { prisma } from './prisma.js';
import { recordBillingEvent, reverseCommission } from './engine.js';

const API_VERSION = '2026-09-30.endive';

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is required');
  if (key.startsWith('sk_live_') && process.env.STRIPE_LIVE_PAYMENTS_ENABLED !== 'true') {
    throw new Error('Live Stripe payments are disabled for Corleon.');
  }
  if (!key.startsWith('sk_test_') && !key.startsWith('sk_live_')) throw new Error('Invalid Stripe secret key.');
  return new Stripe(key, { apiVersion: API_VERSION });
}

function centsToDecimal(amount) {
  return (Number(amount || 0) / 100).toFixed(2);
}

function subscriptionIdFor(object) {
  const value = object?.subscription
    || object?.parent?.subscription_details?.subscription
    || object?.subscription_details?.subscription;
  return typeof value === 'string' ? value : value?.id || null;
}

function customerIdFor(object) {
  const value = object?.customer;
  return typeof value === 'string' ? value : value?.id || null;
}

function directOrganizationId(object) {
  return object?.metadata?.organizationId
    || object?.subscription_details?.metadata?.organizationId
    || object?.parent?.subscription_details?.metadata?.organizationId
    || object?.parent?.metadata?.organizationId
    || null;
}

function isSupportedEvent(type) {
  return [
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed',
    'invoice.paid',
    'invoice.payment_failed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'customer.updated',
    'payment_intent.succeeded',
    'charge.refunded',
    'charge.dispute.created',
    'radar.early_fraud_warning.created',
  ].includes(type);
}

async function resolveOrganizationId(stripe, object) {
  const direct = directOrganizationId(object);
  if (direct) return String(direct);
  const customerId = customerIdFor(object);
  if (customerId) {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted && customer.metadata?.organizationId) return customer.metadata.organizationId;
  }
  const subscriptionId = subscriptionIdFor(object);
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (subscription.metadata?.organizationId) return subscription.metadata.organizationId;
  }
  return null;
}

function mapSubscriptionStatus(status) {
  if (status === 'active') return 'ACTIVE';
  if (status === 'trialing') return 'TRIALING';
  if (status === 'paused') return 'PAUSED';
  if (status === 'canceled') return 'CANCELLED';
  if (status === 'incomplete_expired') return 'EXPIRED';
  return 'PAST_DUE';
}

async function syncSubscription(stripe, subscription, organizationId) {
  const customerId = customerIdFor(subscription);
  if (!customerId) throw new Error('Stripe subscription is missing its customer.');
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) throw new Error('Stripe customer was deleted.');
  const localCustomer = await prisma.customer.upsert({
    where: { organizationId_externalId: { organizationId, externalId: customerId } },
    create: {
      organizationId, externalId: customerId, email: customer.email || null,
      name: customer.name || null, metadata: { provider: 'stripe', customerRef: customer.metadata?.corleonCustomerRef || null },
    },
    update: { email: customer.email || undefined, name: customer.name || undefined },
  });
  const item = subscription.items?.data?.[0];
  const price = item?.price;
  const product = price?.product;
  const productName = typeof product === 'object' && product && !product.deleted ? product.name : null;
  const amount = centsToDecimal(price?.unit_amount ?? 0);
  const currency = String(price?.currency || 'inr').toUpperCase();
  const currentPeriodStart = subscription.current_period_start ? new Date(subscription.current_period_start * 1000) : null;
  const currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null;
  await prisma.subscription.upsert({
    where: { organizationId_externalId: { organizationId, externalId: subscription.id } },
    create: {
      organizationId, customerId: localCustomer.id, externalId: subscription.id,
      status: mapSubscriptionStatus(subscription.status), planId: price?.id || null,
      planName: productName || price?.id || 'Corleon subscription',
      amount, currency, interval: price?.recurring?.interval || null,
      intervalCount: price?.recurring?.interval_count || null,
      currentPeriodStart, currentPeriodEnd,
      cancelledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      metadata: { provider: 'stripe', cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end) },
    },
    update: {
      customerId: localCustomer.id, status: mapSubscriptionStatus(subscription.status),
      planId: price?.id || null, planName: productName || price?.id || 'Corleon subscription',
      amount, currency, interval: price?.recurring?.interval || null,
      intervalCount: price?.recurring?.interval_count || null,
      currentPeriodStart, currentPeriodEnd,
      cancelledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      metadata: { provider: 'stripe', cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end) },
    },
  });
}

async function upsertCustomerFromStripe(stripe, customer, organizationId) {
  if (!customer || customer.deleted) return;
  await prisma.customer.upsert({
    where: { organizationId_externalId: { organizationId, externalId: customer.id } },
    create: {
      organizationId, externalId: customer.id, email: customer.email || null,
      name: customer.name || null,
      metadata: { provider: 'stripe', customerRef: customer.metadata?.corleonCustomerRef || null, address: customer.address || null },
    },
    update: {
      email: customer.email || undefined, name: customer.name || undefined,
      metadata: { provider: 'stripe', customerRef: customer.metadata?.corleonCustomerRef || null, address: customer.address || null },
    },
  });
}

export async function handleStripeWebhook(rawBody, signature) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET is required');
  if (!signature) throw new Error('Missing stripe-signature');
  const stripe = stripeClient();
  const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  const object = event.data.object;

  if (!isSupportedEvent(event.type)) return { eventId: event.id, ignored: true };
  if (event.type === 'payment_intent.succeeded' && object.metadata?.corleonFlow === 'checkout') {
    return { eventId: event.id, ignored: true, reason: 'Checkout Session is the canonical payment event.' };
  }

  const organizationId = await resolveOrganizationId(stripe, object);
  if (!organizationId) throw new Error('Could not resolve organization ownership from Stripe metadata/customer.');
  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_externalId: { provider: 'stripe', externalId: event.id } },
  });
  if (existing?.status === 'PROCESSED') return { duplicate: true, eventId: event.id };

  const webhook = await prisma.webhookEvent.upsert({
    where: { provider_externalId: { provider: 'stripe', externalId: event.id } },
    create: {
      organizationId, provider: 'stripe', externalId: event.id,
      eventType: event.type, payload: event, status: 'PROCESSING',
    },
    update: { organizationId, status: 'PROCESSING', payload: event, errorMessage: null },
  });

  try {
    const customerId = customerIdFor(object);
    let customer = null;
    if (customerId) customer = await stripe.customers.retrieve(customerId);
    if (customer && !customer.deleted) await upsertCustomerFromStripe(stripe, customer, organizationId);

    const customerExternalId = customerId || String(object.metadata?.customerRef || `stripe:${event.id}`);
    const customerEmail = object.customer_details?.email || object.customer_email || object.receipt_email || customer?.email || object.metadata?.customerEmail || null;
    const customerName = object.customer_details?.name || object.customer_name || customer?.name || null;
    const subscriptionExternalId = subscriptionIdFor(object);

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      if (object.mode === 'subscription') {
        if (subscriptionExternalId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionExternalId, { expand: ['items.data.price.product'] });
          await syncSubscription(stripe, subscription, organizationId);
        }
      } else if (object.payment_status !== 'unpaid') {
        await recordBillingEvent({
          organizationId, provider: 'stripe', externalId: event.id, type: 'PAYMENT',
          customerExternalId, customerEmail, customerName,
          orderExternalId: object.metadata?.orderId ? String(object.metadata.orderId) : `stripe:checkout:${object.id}`,
          amount: centsToDecimal(object.amount_total), currency: String(object.currency || 'inr').toUpperCase(),
          occurredAt: new Date(event.created * 1000), rawPayload: event,
        });
      }
    } else if (event.type === 'checkout.session.async_payment_failed') {
      await recordBillingEvent({
        organizationId, provider: 'stripe', externalId: event.id, type: 'PAYMENT_FAILED',
        customerExternalId, customerEmail, customerName,
        orderExternalId: object.metadata?.orderId ? String(object.metadata.orderId) : `stripe:checkout:${object.id}`,
        amount: centsToDecimal(object.amount_total), currency: String(object.currency || 'inr').toUpperCase(),
        occurredAt: new Date(event.created * 1000), rawPayload: event,
      });
    } else if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
      if (subscriptionExternalId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionExternalId, { expand: ['items.data.price.product'] });
        await syncSubscription(stripe, subscription, organizationId);
      }
      await recordBillingEvent({
        organizationId, provider: 'stripe', externalId: event.id,
        type: event.type === 'invoice.payment_failed' ? 'PAYMENT_FAILED'
          : object.billing_reason === 'subscription_create' ? 'SUBSCRIPTION_STARTED' : 'SUBSCRIPTION_RENEWED',
        customerExternalId, customerEmail, customerName,
        orderExternalId: `stripe:invoice:${object.id}`,
        subscriptionExternalId,
        amount: centsToDecimal(event.type === 'invoice.paid' ? object.amount_paid : object.amount_due),
        currency: String(object.currency || 'inr').toUpperCase(),
        occurredAt: new Date(event.created * 1000), rawPayload: event,
      });
    } else if (event.type.startsWith('customer.subscription.')) {
      await syncSubscription(stripe, object, organizationId);
    } else if (event.type === 'customer.updated') {
      await upsertCustomerFromStripe(stripe, object, organizationId);
    } else if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
      const paymentIntentId = object.payment_intent ? String(object.payment_intent) : null;
      const orderExternalId = paymentIntentId ? `stripe:pi:${paymentIntentId}` : null;
      const order = orderExternalId
        ? await prisma.order.findFirst({ where: { organizationId, externalId: orderExternalId } })
        : null;
      if (order) {
        if (event.type === 'charge.refunded') {
          const amount = centsToDecimal(object.amount_refunded);
          const fullyRefunded = Number(object.amount_refunded) >= Number(object.amount);
          await prisma.$transaction(async (tx) => {
            await tx.order.update({ where: { id: order.id }, data: { status: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
            await tx.refund.create({
              data: { orderId: order.id, externalId: `stripe:${event.id}`, provider: 'stripe', amount, currency: String(object.currency).toUpperCase(), reason: 'Stripe refund event' },
            });
          });
        } else {
          await prisma.order.update({ where: { id: order.id }, data: { status: 'CHARGEBACK' } });
        }
        const commissions = await prisma.commission.findMany({
          where: { orderId: order.id, status: { in: ['PENDING', 'APPROVED', 'AVAILABLE', 'PAID'] } },
        });
        for (const commission of commissions) {
          await reverseCommission(commission.id, event.type === 'charge.refunded' ? 'Stripe refund' : 'Stripe dispute');
        }
      }
    } else if (event.type === 'radar.early_fraud_warning.created') {
      await prisma.fraudEvent.create({
        data: {
          organizationId, severity: 'HIGH', type: 'STRIPE_EARLY_FRAUD_WARNING',
          reason: 'Stripe Radar reported an early fraud warning.',
          evidence: { eventId: event.id, objectId: object.id, charge: object.charge || null },
        },
      });
    }

    await prisma.webhookEvent.update({
      where: { id: webhook.id },
      data: { status: 'PROCESSED', processedAt: new Date(), errorMessage: null },
    });
    return { eventId: event.id, result: { processed: true } };
  } catch (error) {
    await prisma.webhookEvent.update({
      where: { id: webhook.id },
      data: { status: 'FAILED', errorMessage: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}
