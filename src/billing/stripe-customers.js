import Stripe from 'stripe';

const ALLOWED_FIELDS = new Set([
  'name',
  'email',
  'phone',
  'description',
  'address',
  'shipping',
  'preferred_locales',
  'tax_exempt',
  'invoice_settings',
  'default_source',
  'default_payment_method',
  'metadata',
  'balance_in_rupees'
]);

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function assertTestMode() {
  const mode = process.env.STRIPE_MODE ?? 'test';
  if (mode !== 'test') {
    throw new Error('Corleon customer updates are restricted to Stripe test mode until production activation is explicitly approved.');
  }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is required.');
  if (!key.startsWith('sk_test_')) {
    throw new Error('STRIPE_SECRET_KEY must be a Stripe test-mode secret key.');
  }
}

export function createStripeCustomerClient() {
  assertTestMode();
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    appInfo: { name: 'Corleon Engine', version: '1.0.0' },
    maxNetworkRetries: 2,
    timeout: 20_000
  });
}

function toStripeMinorUnits(rupees) {
  if (typeof rupees !== 'number' || !Number.isFinite(rupees)) {
    throw new TypeError('balance_in_rupees must be a finite number.');
  }
  const minor = Math.round(rupees * 100);
  if (!Number.isSafeInteger(minor)) {
    throw new RangeError('balance_in_rupees is outside the supported range.');
  }
  return minor;
}

function normalizeUpdates(updates) {
  if (!isRecord(updates)) throw new TypeError('updates must be an object.');
  const unknown = Object.keys(updates).filter((key) => !ALLOWED_FIELDS.has(key));
  if (unknown.length) throw new TypeError(`Unsupported customer fields: ${unknown.join(', ')}`);

  const payload = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (key === 'balance_in_rupees') {
      payload.balance = toStripeMinorUnits(value);
      continue;
    }
    if (key === 'metadata') {
      if (!isRecord(value)) throw new TypeError('metadata must be an object of string values.');
      for (const [metadataKey, metadataValue] of Object.entries(value)) {
        if (typeof metadataValue !== 'string') {
          throw new TypeError(`metadata.${metadataKey} must be a string.`);
        }
      }
      payload.metadata = value;
      continue;
    }
    if (['address', 'shipping', 'invoice_settings'].includes(key) && !isRecord(value)) {
      throw new TypeError(`${key} must be an object.`);
    }
    if (key === 'preferred_locales' && (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))) {
      throw new TypeError('preferred_locales must be an array of strings.');
    }
    if (key === 'tax_exempt' && !['none', 'exempt', 'reverse'].includes(value)) {
      throw new TypeError('tax_exempt must be none, exempt, or reverse.');
    }
    if (['name', 'email', 'phone', 'description', 'default_source', 'default_payment_method'].includes(key)
      && value !== null && typeof value !== 'string') {
      throw new TypeError(`${key} must be a string or null.`);
    }
    payload[key] = value;
  }
  if (Object.keys(payload).length === 0) throw new TypeError('At least one supported customer field must be supplied.');
  return payload;
}

/**
 * Update a Stripe customer belonging to a Corleon organization.
 *
 * organizationId must come from a trusted server-side session/authorization layer,
 * never directly from an untrusted request body. customerId is the local Corleon
 * Customer.id, not a Stripe customer ID supplied by the browser.
 */
export async function updateCorleonStripeCustomer({
  prisma,
  stripe,
  organizationId,
  customerId,
  updates,
  idempotencyKey
}) {
  assertTestMode();
  if (!prisma?.customer?.findFirst || !prisma?.customer?.update) {
    throw new TypeError('A Prisma client with customer.findFirst/update is required.');
  }
  if (!stripe?.customers?.update) {
    throw new TypeError('A Stripe client with customers.update is required.');
  }
  if (typeof organizationId !== 'string' || !organizationId.trim()) {
    throw new TypeError('organizationId is required.');
  }
  if (typeof customerId !== 'string' || !customerId.trim()) {
    throw new TypeError('customerId is required.');
  }
  if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || idempotencyKey.length > 255)) {
    throw new TypeError('idempotencyKey must be a string of at most 255 characters.');
  }

  const payload = normalizeUpdates(updates);
  const localCustomer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
    select: { id: true, organizationId: true, externalId: true, name: true, email: true, metadata: true }
  });
  if (!localCustomer) {
    const error = new Error('Customer not found in this organization.');
    error.code = 'CUSTOMER_NOT_FOUND';
    throw error;
  }

  const stripeCustomerId = String(localCustomer.externalId || '');
  if (!stripeCustomerId.startsWith('cus_')) {
    throw new Error('The Corleon customer is not linked to a valid Stripe customer ID.');
  }

  const stripeCustomer = await stripe.customers.update(
    stripeCustomerId,
    payload,
    idempotencyKey ? { idempotencyKey } : undefined
  );

  const localData = {};
  if (Object.hasOwn(payload, 'name')) localData.name = payload.name;
  if (Object.hasOwn(payload, 'email')) localData.email = payload.email;
  if (Object.hasOwn(payload, 'metadata')) {
    localData.metadata = {
      ...(isRecord(localCustomer.metadata) ? localCustomer.metadata : {}),
      stripeMetadata: payload.metadata
    };
  }

  const customer = Object.keys(localData).length
    ? await prisma.customer.update({ where: { id: localCustomer.id }, data: localData })
    : localCustomer;

  return {
    customer,
    stripeCustomer: {
      id: stripeCustomer.id,
      name: stripeCustomer.name,
      email: stripeCustomer.email,
      phone: stripeCustomer.phone,
      balance: stripeCustomer.balance,
      currency: stripeCustomer.currency,
      address: stripeCustomer.address,
      shipping: stripeCustomer.shipping,
      invoice_settings: stripeCustomer.invoice_settings,
      tax_exempt: stripeCustomer.tax_exempt,
      preferred_locales: stripeCustomer.preferred_locales,
      metadata: stripeCustomer.metadata
    }
  };
}

/** Format an INR minor-unit integer for display without changing stored values. */
export function formatInrMinorUnits(amount) {
  if (!Number.isSafeInteger(amount)) throw new TypeError('amount must be a safe integer in minor units.');
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount / 100);
}
