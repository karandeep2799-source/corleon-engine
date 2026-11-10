import test from 'node:test';
import assert from 'node:assert/strict';
process.env.STRIPE_MODE = 'test';
process.env.STRIPE_SECRET_KEY = 'sk_test_unit_test_only';

import {
  formatInrMinorUnits,
  updateCorleonStripeCustomer
} from '../src/billing/stripe-customers.js';

function fixture() {
  const calls = [];
  const local = {
    id: 'local_customer_1',
    organizationId: 'org_1',
    externalId: 'cus_test_123',
    name: 'Before',
    email: 'before@example.com',
    metadata: { source: 'corleon' }
  };
  const prisma = {
    customer: {
      findFirst: async (args) => {
        calls.push(['findFirst', args]);
        return args.where.id === local.id && args.where.organizationId === local.organizationId ? local : null;
      },
      update: async (args) => {
        calls.push(['update', args]);
        return { ...local, ...args.data };
      }
    }
  };
  const stripe = {
    customers: {
      update: async (...args) => {
        calls.push(['stripeUpdate', args]);
        return {
          id: 'cus_test_123',
          name: args[1].name ?? 'Before',
          email: args[1].email ?? 'before@example.com',
          phone: args[1].phone ?? null,
          balance: args[1].balance ?? 0,
          currency: 'inr',
          address: args[1].address ?? null,
          shipping: args[1].shipping ?? null,
          invoice_settings: args[1].invoice_settings ?? {},
          tax_exempt: args[1].tax_exempt ?? 'none',
          preferred_locales: args[1].preferred_locales ?? [],
          metadata: args[1].metadata ?? {}
        };
      }
    }
  };
  return { calls, prisma, stripe };
}

test('updates only supplied fields and scopes lookup to organization', async () => {
  const { calls, prisma, stripe } = fixture();
  const result = await updateCorleonStripeCustomer({
    prisma, stripe, organizationId: 'org_1', customerId: 'local_customer_1',
    updates: { name: 'After', email: 'after@example.com' },
    idempotencyKey: 'customer-update-001'
  });
  assert.equal(result.stripeCustomer.name, 'After');
  assert.deepEqual(calls[0][1].where, { id: 'local_customer_1', organizationId: 'org_1' });
  assert.deepEqual(calls[1][1][1], { name: 'After', email: 'after@example.com' });
  assert.equal(calls[1][1][2].idempotencyKey, 'customer-update-001');
});

test('converts rupees to Stripe minor units', async () => {
  const { prisma, stripe, calls } = fixture();
  await updateCorleonStripeCustomer({
    prisma, stripe, organizationId: 'org_1', customerId: 'local_customer_1',
    updates: { balance_in_rupees: 125.50 }
  });
  assert.equal(calls[1][1][1].balance, 12550);
});

test('rejects customers outside the organization', async () => {
  const { prisma, stripe } = fixture();
  await assert.rejects(
    updateCorleonStripeCustomer({
      prisma, stripe, organizationId: 'org_other', customerId: 'local_customer_1',
      updates: { name: 'Intruder' }
    }),
    { code: 'CUSTOMER_NOT_FOUND' }
  );
});

test('rejects unsupported fields', async () => {
  const { prisma, stripe } = fixture();
  await assert.rejects(
    updateCorleonStripeCustomer({
      prisma, stripe, organizationId: 'org_1', customerId: 'local_customer_1',
      updates: { card_number: '4242424242424242' }
    }),
    /Unsupported customer fields/
  );
});

test('formats INR minor units for display', () => {
  assert.equal(formatInrMinorUnits(12550), '₹125.50');
});
