import Stripe from 'stripe';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from './prisma.js';

const API_VERSION = '2026-09-30.endive';
const MAX_LINE_AMOUNT_PAISE = 50_000_000;
const CURRENCY = 'inr';

let stripeClient;
function stripe() {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe is not configured.');
  if (key.startsWith('sk_live_') && process.env.STRIPE_LIVE_PAYMENTS_ENABLED !== 'true') {
    throw new Error('Live Stripe payments are disabled for Corleon.');
  }
  if (!key.startsWith('sk_test_') && !key.startsWith('sk_live_')) {
    throw new Error('STRIPE_SECRET_KEY must be a Stripe secret key.');
  }
  stripeClient = new Stripe(key, { apiVersion: API_VERSION });
  return stripeClient;
}

function requiredString(value, name, max = 200) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw new Error(`Invalid ${name}.`);
  }
  return value.trim();
}

function idempotencyKey(value) {
  return requiredString(value, 'idempotencyKey', 100).match(/^[A-Za-z0-9._:-]{12,100}$/)
    ? value
    : (() => { throw new Error('A valid idempotencyKey (12–100 safe characters) is required.'); })();
}

function authorize(token) {
  const expected = process.env.CORLEON_BILLING_API_TOKEN;
  if (!expected || expected.length < 32 || typeof token !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

function assertReturnUrl(value, name, requireSessionPlaceholder = false) {
  const raw = requiredString(value, name, 2048);
  let url;
  try { url = new URL(raw); } catch { throw new Error(`Invalid ${name}.`); }
  const allowed = (process.env.CORLEON_BILLING_RETURN_ORIGINS || 'https://corleon-engine.vercel.app')
    .split(',').map((origin) => origin.trim()).filter(Boolean);
  const localAllowed = process.env.NODE_ENV !== 'production' && ['http://localhost:3000', 'http://127.0.0.1:3000'];
  if (url.protocol !== 'https:' && !localAllowed.includes(url.origin)) throw new Error(`${name} must use HTTPS.`);
  if (!allowed.includes(url.origin) && !localAllowed.includes(url.origin)) throw new Error(`${name} origin is not allowlisted.`);
  if (requireSessionPlaceholder && !raw.includes('{CHECKOUT_SESSION_ID}')) {
    throw new Error('successUrl must include {CHECKOUT_SESSION_ID}.');
  }
  return raw;
}

function integrationIdentifier() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const suffix = Array.from(randomBytes(8), (byte) => alphabet[byte % alphabet.length]).join('');
  return `corleon_web_${suffix}`;
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function assertOrganization(organizationId) {
  const id = requiredString(organizationId, 'organizationId', 128);
  const organization = await prisma.organization.findUnique({ where: { id }, select: { id: true } });
  if (!organization) throw new Error('Unknown Corleon organization.');
  return id;
}

async function assertStripeCustomer(customerId, organizationId) {
  const id = requiredString(customerId, 'customerId', 100);
  if (!/^cus_[A-Za-z0-9]+$/.test(id)) throw new Error('Invalid Stripe customer ID.');
  const customer = await stripe().customers.retrieve(id);
  if (customer.deleted || customer.metadata?.organizationId !== organizationId) {
    throw new Error('Customer does not belong to this Corleon organization.');
  }
  return customer;
}

export function authorizeBillingRequest(token) {
  return authorize(token);
}

export async function createCorleonCheckout(input) {
  const organizationId = await assertOrganization(input.organizationId);
  const customerRef = requiredString(input.customerRef, 'customerRef', 128);
  const email = requiredString(input.customerEmail, 'customerEmail', 320);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid customerEmail.');
  const name = typeof input.customerName === 'string' ? input.customerName.slice(0, 160) : undefined;
  const productKey = requiredString(input.productKey, 'productKey', 100);
  const priceId = requiredString(input.priceId, 'priceId', 100);
  if (!/^price_[A-Za-z0-9]+$/.test(priceId)) throw new Error('Invalid Stripe price ID.');
  const mode = input.mode === 'subscription' ? 'subscription' : input.mode === 'payment' ? 'payment' : null;
  if (!mode) throw new Error('mode must be payment or subscription.');
  const successUrl = assertReturnUrl(input.successUrl, 'successUrl', true);
  const cancelUrl = assertReturnUrl(input.cancelUrl, 'cancelUrl');
  const key = idempotencyKey(input.idempotencyKey);

  const price = await stripe().prices.retrieve(priceId, { expand: ['product'] });
  const product = typeof price.product === 'string' ? await stripe().products.retrieve(price.product) : price.product;
  if (!price.active || price.currency !== CURRENCY || !product || product.deleted || !product.active) {
    throw new Error('Price must be active, INR-denominated, and attached to an active product.');
  }
  if ((mode === 'subscription') !== Boolean(price.recurring)) {
    throw new Error('Checkout mode does not match the selected Stripe price.');
  }

  const customerKey = `corleon-customer-${hash(`${organizationId}:${customerRef}`).slice(0, 48)}`;
  const customer = await stripe().customers.create({
    email,
    ...(name ? { name } : {}),
    metadata: {
      organizationId,
      corleonCustomerRef: customerRef,
      corleonPlatform: 'corleon',
    },
  }, { idempotencyKey: customerKey });
  await stripe().customers.update(customer.id, { email, ...(name ? { name } : {}) });

  await prisma.customer.upsert({
    where: { organizationId_externalId: { organizationId, externalId: customer.id } },
    create: { organizationId, externalId: customer.id, email, name: name || null, metadata: { customerRef, provider: 'stripe' } },
    update: { email, name: name || undefined, metadata: { customerRef, provider: 'stripe' } },
  });

  const orderId = `corleon_${hash(`${organizationId}:${key}`).slice(0, 32)}`;
  const metadata = { organizationId, orderId, customerRef, productKey, provider: 'stripe', corleonFlow: 'checkout' };
  const params = {
    mode,
    customer: customer.id,
    line_items: [{ price: price.id, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: customerRef,
    metadata,
    integration_identifier: integrationIdentifier(),
    billing_address_collection: 'required',
    customer_update: { address: 'auto', name: 'auto' },
    tax_id_collection: { enabled: true },
    ...(mode === 'payment'
      ? { invoice_creation: { enabled: true, invoice_data: { metadata } }, payment_intent_data: { metadata } }
      : { subscription_data: { metadata } }),
  };
  const session = await stripe().checkout.sessions.create(params, { idempotencyKey: key });
  if (!session.url) throw new Error('Stripe did not return a Checkout URL.');
  return { sessionId: session.id, checkoutUrl: session.url, customerId: customer.id, mode, currency: CURRENCY.toUpperCase() };
}

export async function createCorleonPortalSession(input) {
  const organizationId = await assertOrganization(input.organizationId);
  await assertStripeCustomer(input.customerId, organizationId);
  const returnUrl = assertReturnUrl(input.returnUrl, 'returnUrl');
  const configuration = process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID;
  const session = await stripe().billingPortal.sessions.create({
    customer: input.customerId,
    return_url: returnUrl,
    ...(configuration ? { configuration } : {}),
  });
  return { url: session.url, expiresAt: session.expires_at };
}

export async function createCorleonInvoice(input) {
  const organizationId = await assertOrganization(input.organizationId);
  const customer = await assertStripeCustomer(input.customerId, organizationId);
  const key = idempotencyKey(input.idempotencyKey);
  if (!Array.isArray(input.lineItems) || input.lineItems.length < 1 || input.lineItems.length > 20) {
    throw new Error('lineItems must contain between 1 and 20 entries.');
  }
  const items = input.lineItems.map((item) => {
    const amount = item?.amountPaise;
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_LINE_AMOUNT_PAISE) {
      throw new Error('Each invoice line amount must be integer paise between ₹0.01 and ₹5,00,000.');
    }
    return { amount, description: requiredString(item.description, 'line item description', 500) };
  });
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  if (total > MAX_LINE_AMOUNT_PAISE) throw new Error('Invoice total exceeds ₹5,00,000.');
  const metadata = { organizationId, customerRef: customer.metadata?.corleonCustomerRef || '', provider: 'stripe' };
  const invoice = await stripe().invoices.create({
    customer: customer.id,
    currency: CURRENCY,
    collection_method: 'send_invoice',
    days_until_due: Number.isInteger(input.daysUntilDue) && input.daysUntilDue >= 1 && input.daysUntilDue <= 90 ? input.daysUntilDue : 14,
    auto_advance: false,
    metadata,
  }, { idempotencyKey: key });
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    await stripe().invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      amount: item.amount,
      currency: CURRENCY,
      description: item.description,
      metadata,
    }, { idempotencyKey: `${key}:item:${index}` });
  }
  const finalized = await stripe().invoices.finalizeInvoice(invoice.id);
  const sent = await stripe().invoices.sendInvoice(finalized.id);
  return { invoiceId: sent.id, hostedInvoiceUrl: sent.hosted_invoice_url, invoicePdf: sent.invoice_pdf, amountDue: sent.amount_due, currency: sent.currency };
}
