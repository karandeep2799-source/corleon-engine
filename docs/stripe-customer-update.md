# Corleon Stripe Customer Update

This module implements a server-side, organization-scoped update flow for existing Stripe customers. It uses the existing `Customer.externalId` mapping and does not create customers.

## Safety defaults

- `STRIPE_MODE` defaults to `test`; any other value is rejected.
- `STRIPE_SECRET_KEY` must start with `sk_test_`.
- No Stripe credentials are accepted from clients.
- The caller must derive `organizationId` from a trusted server-side session and pass the local Corleon `Customer.id`, never a browser-supplied Stripe ID.
- Customer lookup is scoped by both `id` and `organizationId`.
- Updates are allow-listed; omitted fields are not sent to Stripe.
- Supply an idempotency key for retried mutations.
- The module never creates a customer, changes account mode, or activates live payments.

## Supported fields

Stripe-compatible fields: `name`, `email`, `phone`, `description`, `address`, `shipping`, `preferred_locales`, `tax_exempt`, `invoice_settings`, `default_source`, `default_payment_method`, and `metadata`.

Corleon-specific `balance_in_rupees` is converted to Stripe's minor-unit integer. INR is displayed as rupees; never divide or multiply an amount twice.

## Example

```js
import { prisma } from '../cashflow/prisma.js';
import {
  createStripeCustomerClient,
  updateCorleonStripeCustomer
} from './stripe-customers.js';

const stripe = createStripeCustomerClient();

// organizationId must be resolved by your authenticated server-side
// organization membership guard before this call.
const result = await updateCorleonStripeCustomer({
  prisma,
  stripe,
  organizationId: authenticatedOrganization.id,
  customerId: params.customerId,
  updates: {
    name: 'Corleon Customer',
    email: 'customer@example.com',
    address: { country: 'IN', city: 'Jaipur', postal_code: '302001' }
  },
  idempotencyKey: request.headers.get('idempotency-key')
});
```

## Verification

Run the focused tests with:

```sh
node --test tests/stripe-customers.test.js
```

The module is deliberately a service boundary, not an unauthenticated HTTP route. Wire it to the application's established session and organization authorization middleware before exposing it over HTTP.
