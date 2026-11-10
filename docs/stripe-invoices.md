# Corleon Stripe Invoice Engine

## Scope
Shared INR-first invoice service for Corleon Engine and standalone Corleon applications. The integration is sandbox-only by default. It creates draft invoices, attaches line items in paise, persists invoice state, and finalizes only through an explicit endpoint.

## Environment
Configure server-side variables in local development and Vercel Preview:

- `STRIPE_SECRET_KEY=sk_test_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`
- `CORLEON_BILLING_API_KEY=<long-random-server-to-server-secret>`
- `STRIPE_LIVE_PAYMENTS_ENABLED=false`
- `DATABASE_URL=postgresql://...`

Never expose secrets with a `NEXT_PUBLIC_` prefix or commit populated environment files.

## API
All billing endpoints require `Authorization: Bearer <CORLEON_BILLING_API_KEY>`.

### Create a draft invoice
`POST /api/billing/invoices`

```json
{
  "organizationId": "org_id",
  "customerId": "customer_id",
  "description": "Corleon services",
  "dueDays": 7,
  "items": [{ "description": "AI automation setup", "amount": 1250.00 }]
}
```

Amounts are entered and returned in Indian rupees (₹), with up to two decimal places (1250.00 = ₹1,250.00). The service converts rupees to paise only internally when calling Stripe, because Stripe's INR API amounts use the smallest currency unit. Currency is fixed to INR. The invoice remains draft; it is not sent or charged automatically.

### List invoices
`GET /api/billing/invoices?organizationId=...&customerId=...`

### Finalize an invoice
`POST /api/billing/invoices/{localInvoiceId}/finalize`

Finalization is explicit. Stripe's hosted invoice URL and PDF URL are stored after finalization. To deliver the invoice through Stripe's hosted invoice workflow, call `POST /api/billing/invoices/{localInvoiceId}/send` after finalization. This invokes Stripe's invoice email delivery and returns the hosted invoice URL. Delivery is a separate, explicit action; creating or finalizing a draft does not email the customer.

### Webhooks
Configure `POST /api/webhooks/stripe` and subscribe to `invoice.finalized`, `invoice.sent`, `invoice.paid`, `invoice.payment_failed`, `invoice.voided`, `invoice.marked_uncollectible`, and `invoice.updated`. The handler verifies signatures against the raw body, preserves the existing cash-flow handler, and synchronizes invoice state for `invoice.*` events. Treat `invoice.paid` as the canonical settled event for local payment status. Configure only events the application consumes, and test duplicate delivery and retry behavior before release.

## Database
Run `pnpm prisma:generate` and review/apply migrations using `pnpm prisma:deploy` against a non-production database first. Do not run migrations automatically during Vercel deployment.

## Release checklist
1. Provision a restricted Stripe sandbox key and webhook signing secret.
2. Set secrets in Vercel Preview only.
3. Apply the migration to a non-production database.
4. Test draft creation, finalization, explicit email delivery, hosted URL/PDF, webhook retries and duplicate events.
5. Integrate the customer UI with the application's existing identity/session provider before exposing invoice records to end customers.
6. Keep live payments disabled until separate approval and compliance review.
