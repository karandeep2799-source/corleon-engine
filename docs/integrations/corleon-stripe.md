# Corleon Stripe Billing — sandbox-first shared payment workflow

## Status

- Stripe account: `kar sandbox`
- Account mode: sandbox/test
- Customer Portal configuration created: `bpc_1UaFn3PqxJ12Pn9aNj6mPGsp`
- Customer Portal configuration: invoice history, payment-method updates, customer profile updates, and cancellation at period end
- Live payments: disabled
- Webhook endpoint registration: pending deployment of the new handler and configuration of its signing secret
- Vercel environment variables: Stripe credentials are not currently configured on the linked project

This integration adds Stripe alongside the existing Razorpay adapter. It does not replace Razorpay or alter existing payout/commission flows.

## Architecture

```text
Corleon Engine / standalone app server
            |
            | authenticated server-to-server request
            v
  /api/billing/checkout       /api/billing/invoices
            |                           |
            +------------+--------------+
                         |
                 Stripe Billing service
                         |
        +----------------+------------------+
        |                |                  |
   Checkout          Invoicing          Customer Portal
   one-time +         API + hosted       subscriptions,
   subscriptions     invoice page       invoices, payment
        |                |                  |
        +----------------+------------------+
                         |
                /api/webhooks/stripe
                         |
             signature verification
                         |
             Corleon billing engine
                         |
          Prisma / PostgreSQL ledger
```

## API surface

All three billing routes require a server-to-server bearer token. Never call them directly from browser code or mobile apps, and never ship `CORLEON_BILLING_API_TOKEN` to a client.

### Create hosted Checkout

`POST /api/billing/checkout`

Required JSON fields:

- `organizationId`: existing Corleon organization ID
- `customerRef`: stable customer ID from the calling application
- `customerEmail`
- `customerName` (optional)
- `productKey`: internal Corleon product/plan key
- `priceId`: active Stripe Price ID
- `mode`: `payment` or `subscription`
- `successUrl`: allowlisted HTTPS URL containing `{CHECKOUT_SESSION_ID}`
- `cancelUrl`: allowlisted HTTPS URL
- `idempotencyKey`: unique stable key for this checkout attempt

The service retrieves the Stripe Price and requires an active INR-denominated price. Subscription mode must match a recurring Price. The server creates/reuses the Stripe Customer idempotently, creates a hosted Checkout Session, and returns its URL. The amount is always determined by the Stripe Price; callers cannot submit an arbitrary amount.

For one-time Checkout, Stripe invoice creation is enabled. Subscription Checkout uses Stripe Billing, which creates invoices for the initial and renewal payments. Dynamic payment methods are enabled by omitting `payment_method_types`. Tax calculation is intentionally not enabled until the merchant confirms active tax registrations.

### Create an invoice from a Corleon business event

`POST /api/billing/invoices`

Required fields:

- `organizationId`
- `customerId`: Stripe Customer ID belonging to the organization
- `idempotencyKey`
- `lineItems`: 1–20 entries with `amountPaise` (integer paise) and `description`
- `daysUntilDue` (optional, 1–90; defaults to 14)

Amounts are validated as integer paise. The service creates a draft invoice, attaches line items, finalizes it, and sends it through Stripe's hosted invoice flow. It returns the hosted invoice URL and PDF URL.

### Create a Customer Portal session

`POST /api/billing/portal`

Required fields:

- `organizationId`
- `customerId`: Stripe Customer ID belonging to the organization
- `returnUrl`: allowlisted HTTPS URL

The service verifies the Stripe Customer's `metadata.organizationId` before creating a short-lived portal session. The sandbox portal configuration is set up with invoice history, payment-method updates, customer detail updates, and end-of-period cancellation. Plan upgrades/downgrades remain disabled until the product/price catalog is configured.

### Example server-to-server request

```bash
curl -X POST "$CORLEON_API_URL/api/billing/checkout" \
  -H "Authorization: Bearer $CORLEON_BILLING_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "org_id_from_your_database",
    "customerRef": "customer_id_from_your_database",
    "customerEmail": "buyer@example.com",
    "productKey": "corleon-pro-monthly",
    "priceId": "price_test_from_stripe_catalog",
    "mode": "subscription",
    "successUrl": "https://app.example.com/billing/success?session_id={CHECKOUT_SESSION_ID}",
    "cancelUrl": "https://app.example.com/pricing",
    "idempotencyKey": "checkout_customer_123_20261110"
  }'
```

The example IDs and domains are placeholders. Do not use a client-supplied price or amount as the source of truth.

## Webhook processing

The handler verifies the raw request body with `stripe-signature` and `STRIPE_WEBHOOK_SECRET`. It stores provider event IDs in the existing webhook ledger and deduplicates retries. Failed processing returns HTTP 500 so Stripe retries; invalid signatures return HTTP 400.

Subscribe only to the event types this application handles:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.updated`
- `payment_intent.succeeded` (legacy flows)
- `charge.refunded`
- `charge.dispute.created`
- `radar.early_fraud_warning.created`

Fulfillment is webhook-driven, never based only on the Checkout return page. For delayed payment methods, the session is fulfilled only after the async success event. Subscription records are synchronized from Stripe's subscription object; invoice paid/failed events drive recurring billing state. Refund/dispute events update the local order and reverse eligible affiliate commissions.

After a public deployment is available, create a test-mode webhook endpoint pointing to:

`https://<public-host>/api/webhooks/stripe`

Copy the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET` in the matching Vercel environment. Do not point Stripe at a Vercel preview deployment protected by SSO; Stripe cannot authenticate to that preview URL. Use a public test endpoint or a local Stripe CLI forwarder for development.

## Configuration and deployment

1. Create a restricted Stripe API key for the sandbox. Prefer an `rk_test_` key with only the permissions required by Checkout, Customers, Prices, Invoices, Billing Portal, Subscriptions, and webhook reads. Keep the Stripe account itself in test mode.
2. Set the following server-only variables in Vercel Preview and Development:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `CORLEON_BILLING_API_TOKEN`
   - `CORLEON_BILLING_RETURN_ORIGINS`
   - `STRIPE_BILLING_PORTAL_CONFIGURATION_ID`
   - `STRIPE_LIVE_PAYMENTS_ENABLED=false`
3. Configure an allowlist of all standalone app return origins.
4. Add test Products and Prices in the Stripe sandbox. Create distinct Products for each plan; attach monthly and annual Prices to the same plan Product. All initial Prices must be INR.
5. Deploy a public preview or use Stripe CLI forwarding, register the webhook event list above, and save its signing secret in Vercel.
6. Run typecheck, tests, build, sandbox Checkout, invoice payment, subscription renewal/failure, portal cancellation, refund, dispute, webhook retry, and duplicate-event tests.
7. Verify reconciliation against Stripe and the Corleon ledger before any production rollout.

## Security and operational requirements

- Live-mode keys are rejected unless `STRIPE_LIVE_PAYMENTS_ENABLED=true`; keep this false for the requested sandbox phase.
- Use a restricted API key instead of a full secret key when permissions allow.
- All billing APIs require a high-entropy server-to-server bearer token. Do not expose it in the browser or mobile app.
- Customer ownership is verified against Stripe Customer metadata and the Corleon organization ID.
- Checkout requires a server-selected active INR Price. The browser cannot choose an amount.
- Checkout return URLs are HTTPS and origin-allowlisted to prevent open redirects.
- Stripe secrets and webhook secrets must never use a `NEXT_PUBLIC_` prefix.
- The app stores no raw card or UPI credentials.
- Webhook fulfillment is idempotent; use Stripe's event ID as the provider event key.
- Keep webhook delivery failures, invoice failures, refunds, disputes, and early fraud warnings observable.
- Refund actions require a separate authenticated, audited workflow; this change only synchronizes Stripe-originated refund events.

## Tax and India-specific notes

The current integration collects billing addresses and can collect customer tax IDs, but it does not enable `automatic_tax`. Stripe Tax only calculates and collects tax where the business has an active registration recorded in Stripe. Confirm GST registration and applicable tax treatment with a qualified tax advisor before enabling automatic tax. Recording a registration in Stripe does not register the business with the tax authority. INR pricing and Stripe payment-method availability also depend on the merchant account's country, capabilities, and the payment method's eligibility.

## Remaining inputs before sandbox end-to-end testing

- Add a sandbox restricted API key to Vercel.
- Generate a high-entropy `CORLEON_BILLING_API_TOKEN` and add it to Vercel.
- Confirm the Corleon organization ID and stable customer ID mapping used by calling apps.
- Add actual Corleon Products/Prices and their INR amounts in Stripe sandbox.
- Deploy a public test endpoint or use Stripe CLI forwarding, then configure the webhook signing secret.
- Confirm GST registration status before enabling any tax calculation.

## Go-live boundary

No live payment key, live product, live webhook, live tax registration, production migration, production deployment, or live charge is created by this workflow. A separate explicit approval and a full Stripe go-live checklist are required before changing that boundary.
