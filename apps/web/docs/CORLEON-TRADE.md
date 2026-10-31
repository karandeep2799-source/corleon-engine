# Corleon Trade

Corleon Trade is the multi-market trading workspace inside Corleon Engine. It targets US equities, Indian NSE/BSE equities, crypto, forex, and commodities.

## Current delivery boundary

This commit delivers the application foundation, authenticated dashboard, PostgreSQL/Prisma trading schema, market capability endpoint, pre-trade validation, audit events, and an idempotent order API boundary.

**Real order execution is deliberately disabled.** No certified broker adapter or market-data adapter is included in this commit. The order endpoint fails closed and will not transmit orders. Do not set `LIVE_TRADING_ENABLED=true` until provider-specific adapters, contract tests, secret-vault integration, broker sandbox certification, risk controls, reconciliation, incident procedures, and jurisdictional compliance approval are complete.

## Provider integration plan

| Market | Candidate provider | Notes |
|---|---|---|
| US stocks | Alpaca / Interactive Brokers | Account eligibility, market-data entitlements, order types, and regional availability must be verified |
| Crypto | Coinbase Advanced / Kraken | Confirm supported jurisdiction, custody model, asset allowlist, and exchange permissions |
| NSE/BSE | Zerodha Kite Connect / Upstox | India-specific broker onboarding, exchange permissions, product types, and regulatory requirements apply |
| Forex | Interactive Brokers / permitted Indian broker APIs | Indian resident access and permitted currency pairs/products require legal review; do not assume offshore spot FX is permitted |
| Commodities | Zerodha / Upstox / exchange-authorized broker | Confirm MCX or other exchange segment authorization and suitability |

Provider names are integration candidates, not statements that every product is available to every user.

## Security model

- Google ID token verification uses the configured OAuth client ID.
- App sessions are signed HS256 JWTs in an HttpOnly, Secure, SameSite=Lax host-only cookie.
- Session signing secret must be at least 32 characters and stored in Vercel encrypted environment variables.
- Broker credentials must live in a managed secret vault. The database stores only a secret reference.
- Every order request requires an authenticated user, owned active account, active provider connection, market risk policy, and Idempotency-Key.
- Market order policy defaults to limit-only until the user's market-specific risk policy says otherwise.
- All order denials are auditable. Provider adapters must be independently certified and must never log credentials or signed requests.

## Setup

1. Configure a managed PostgreSQL database and set `DATABASE_URL`.
2. Set `SESSION_SECRET` and `GOOGLE_CLIENT_ID` in Vercel.
3. Install workspace dependencies and run Prisma generation/migrations:
   ```bash
   pnpm install
   pnpm --filter @corleon/web exec prisma generate
   pnpm --filter @corleon/web exec prisma migrate deploy
   ```
4. Set Vercel project root to `apps/web` and build command to `pnpm build:web` (or use the repository's existing Turborepo Vercel configuration).
5. Keep `LIVE_TRADING_ENABLED=false` until all production gates pass.

## Production gates still required

- Complete provider-specific OAuth/API adapters and webhook signature verification.
- Add secret-vault integration (Vercel encrypted env for bootstrap; managed vault for per-user credentials).
- Add market-data entitlement checks, streaming quote service, stale-price rejection, exchange calendars, and currency conversion.
- Add market-specific order validation, tick-size/lot-size rules, buying-power and margin checks, short-sale/derivatives permissions, and kill switch.
- Add reconciliation worker for broker orders, fills, positions, balances, corporate actions, and exchange rejects.
- Add rate limits, CSRF/origin checks, durable idempotency reservation, outbox/queue processing, alerts, and incident runbooks.
- Complete India FEMA/RBI/SEBI/exchange compliance review for resident access to each asset class and broker product.
- Obtain qualified legal/compliance approval before enabling forex, commodities, derivatives, or cross-border products.

## Operational principle

A successful API response from Corleon Trade is not proof that an exchange order was accepted. The broker's authoritative order/fill stream and reconciliation ledger are the source of truth.
