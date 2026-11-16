# Corleon Engine — Production Readiness

**Audit baseline:** main at c0e46022a816557a6988a75b9ad02d300e87f7bd  
**Remediation branch:** fix/financial-integrity-readiness  
**Scope:** targeted integrity, webhook, readiness, and operational-safety fixes. This document is not a certification that the entire platform is production-ready.

## What this change hardens

- The public health endpoint performs a PostgreSQL readiness probe. It returns HTTP 200 only when the database query succeeds and HTTP 503 otherwise. It does not expose connection strings or provider errors.
- Affiliate balances remain single-currency because the current Prisma model has one balance row and one currency per affiliate. Billing events in a second currency are rejected and rolled back instead of mixing values.
- Payout requests verify organization ownership, affiliate eligibility, payout-account ownership, payout method, and verified account status. The legacy route takes organization identity from trusted req.auth middleware, not the request body, and permits only OWNER, ADMIN, and FINANCE roles.
- Payout creation uses a serializable transaction and refuses another active payout for the same affiliate. It allocates available commissions but does not mark them PAID or reduce the available balance before provider settlement.
- Payout execution is opt-in and disabled by default. A payout is marked PAID and the balance/ledger are updated only after a provider returns a confirmed paid result. Ambiguous provider errors keep the payout in PROCESSING with commissions reserved for reconciliation; they are not automatically released for a second payout.
- Stripe inbound and outbound amounts use exact decimal strings and integer minor units, including Stripe's zero-decimal currencies and its documented special handling for ISK, HUF, TWD, and UGX. Invalid precision is rejected rather than rounded through JavaScript floating-point arithmetic.
- Stripe webhook signature failures return HTTP 400, configuration failures return HTTP 503, and processing failures return HTTP 500 so Stripe can retry. Internal exception messages are no longer returned to the caller.
- Commission release uses a conditional status transition under a serializable transaction to avoid two workers releasing the same commission concurrently.
- The environment example documents Binance portfolio controls and keeps private monitoring disabled by default.

## Important operating constraints

1. The current balance schema supports one currency per affiliate. Multi-currency balances require a separate schema migration and application-wide changes; this patch deliberately does not pretend to support them.
2. Payout execution is guarded by PAYOUT_EXECUTION_ENABLED=false. Do not set it to true until payout account verification, finance authorization, provider idempotency, reconciliation operations, and a staging settlement test have been approved.
3. A payout left in PROCESSING after an ambiguous provider response must be reconciled against the provider before any retry or replacement payout. Do not delete its payout items or release the associated commissions manually without a finance audit.
4. Stripe Connect transfer creation only credits a connected account balance; it is not proof of a bank payout. The Stripe provider therefore leaves the payout in PROCESSING until a separately designed and verified settlement/reconciliation workflow confirms final payout.
5. The legacy Express-style requestPayout route requires trusted middleware to attach req.auth with organizationId and role. It fails closed if that context is absent. The current Next.js app does not expose this legacy handler as a route.
6. The health endpoint is a readiness check, not a liveness check. A database outage intentionally produces HTTP 503.

## Remaining release blockers

- Verify the deployed Vercel environment has the intended DATABASE_URL, Stripe webhook settings, cron secret, and any enabled integration secrets. Values were not read or exposed during this audit.
- Run GitHub Actions on this branch/PR and resolve every lint, typecheck, test, and build failure. The repository CI workflow is the authoritative build gate; no local build is claimed by this document.
- Run a staging database migration check and real PostgreSQL integration tests for payout creation, commission release, duplicate Stripe events, and payout reconciliation.
- Confirm the authentication middleware contract for req.auth before mounting the legacy payout handler. Do not expose it directly.
- Review Stripe refund and dispute semantics. The current webhook flow reverses all commissions on an order for refund/dispute events; partial refunds need proportional commission adjustments and won-dispute recovery before the billing subsystem is considered complete.
- Add role-scoped administration, audit-log writes for payout approvals/reconciliation, and operational dashboards for stuck PROCESSING payouts.
- Confirm the current deployment and health response from the production domain after a separately approved release. This remediation branch does not change production.

## Verification status

- Repository source inspected at the audit baseline.
- Remediation branch created from the inspected main commit.
- Code-level changes and focused money-conversion unit tests are included in this branch.
- CI execution, staging database verification, Vercel environment verification, and production smoke testing remain release gates.
