# Corleon Pay — shared frontend/backend payment layer

## Scope

Corleon Pay is a provider-neutral payment boundary with Razorpay as the first adapter. The same server API and transaction ledger are used by the web checkout component and approved WhatsApp Business checkout configurations. Corleon is not WhatsApp Pay, a PSP bank, a TPAP, or a custodian of customer funds.

## Architecture

- Frontend: `apps/web/components/PaymentPlayer.tsx`
- Order API: `POST /api/payments/orders`
- Verification API: `POST /api/payments/verify`
- Webhook: `POST /api/payments/webhook`
- Provider adapter: `apps/web/lib/payments/razorpay.ts`
- Persistence: Prisma + PostgreSQL
- Amounts: integer paise; currency fixed to INR in this initial adapter.

## Authentication integration

The routes fail closed unless `AUTH_SECRET` is configured and a valid HS256 JWT is present in the cookie named by `PAYMENT_SESSION_COOKIE` (default `corleon_session`). The token must contain `sub` and a future `exp`; optionally it must match `PAYMENT_SESSION_ISSUER`.

If the existing Corleon authentication provider issues a different cookie or token format, replace only `getPaymentActor` with an adapter that verifies that provider's server-side session. Do not weaken the default to trust a user ID supplied in JSON or headers. Ensure the session issuer uses the same secret and HS256 policy before enabling checkout.

## Environment

Required server-only variables:

- `DATABASE_URL`
- `AUTH_SECRET` — high-entropy session signing secret, shared only with the trusted session issuer.
- `RAZORPAY_KEY_ID` — test key first; public key ID is returned to checkout.
- `RAZORPAY_KEY_SECRET` — never expose to browser.
- `RAZORPAY_WEBHOOK_SECRET` — separate webhook secret configured in Razorpay dashboard.
- `PAYMENT_SESSION_COOKIE` (optional; defaults to `corleon_session`)
- `PAYMENT_SESSION_ISSUER` (optional; enforce issuer claim)

Do not prefix payment secrets with `NEXT_PUBLIC_`.

## Setup

1. Install dependencies from the repository root with pnpm.
2. Generate Prisma Client: `pnpm --filter @corleon/web prisma:generate`.
3. Apply migration to a non-production database: `pnpm --filter @corleon/web prisma:migrate:deploy`.
4. Configure Razorpay test credentials and webhook endpoint `/api/payments/webhook`.
5. Subscribe to `payment.captured`, `payment.failed`, and `order.paid`.
6. Verify the session cookie bridge with an authenticated test account.
7. Run typecheck, tests, and a production build before review.

## WhatsApp Business checkout

WhatsApp's India Payments terms describe WhatsApp Pay as a TPAP service operating with designated PSP banks over UPI; they do not grant third parties access to WhatsApp's internal payment rails. Corleon must not represent itself as WhatsApp Pay or attempt to collect a customer's UPI PIN.

For business checkout in WhatsApp, use the official WhatsApp Business Platform and an approved, configured payment option. Razorpay documents a WhatsApp payment integration that requires linking Razorpay with the WhatsApp Business Account, and a BSP/Meta onboarding path. Depending on eligibility and configuration, the channel may use WhatsApp's payment gateway integration or a provider-issued UPI intent/payment link. The provider's order and webhook remain authoritative.

Do not send an ordinary Razorpay checkout URL as though it were a native WhatsApp Pay integration. Confirm the WhatsApp Manager payment configuration, WABA ownership, provider approval, and current availability before enabling that channel. WhatsApp channel order details/status messages should reference the same Corleon payment/order IDs and should never mark an order paid based only on a client-side redirect.

## Security controls

- Session JWT verification is server-side and fails closed.
- Same-origin checks on browser mutation endpoints.
- Integer paise validation and ₹5,00,000 per-order ceiling for this initial implementation; adjust only after risk review.
- Idempotency key is unique in PostgreSQL and bound to the user and amount.
- Razorpay checkout HMAC verification uses constant-time comparison.
- Checkout verification fetches the payment from Razorpay and checks order, amount, currency and captured state.
- Webhook HMAC verifies the raw request body; provider event IDs are unique to deduplicate retries.
- API secrets remain server-side; UPI PIN/card data is never handled or stored by Corleon.
- Webhook endpoint does not trust browser session identity.

## Operational limitations / required hardening before live

- Integrate `getPaymentActor` with the actual Corleon auth issuer and confirm its token format; the repository did not expose an existing auth module at implementation time.
- Add tenant ownership / order entitlement checks in the application service before exposing checkout to end users.
- Add reconciliation jobs for pending/authorized payments and refunds, plus a refund workflow with explicit authorization.
- Add durable rate limiting at the edge or in a shared store (not process memory).
- Add alerting for webhook failures, reconciliation drift, and settlement mismatches.
- Configure Razorpay webhook retries and monitor delivery.
- Run gateway sandbox tests and a security review. Live payments remain disabled until merchant KYC, account approval, webhook setup, policies, and production credentials are verified.

## Rollback

Disable checkout at the application feature flag / remove the payment component from entry points. Keep the ledger and webhook route available for delayed provider events. Do not delete payment records or replay webhook events manually without an audited runbook.
