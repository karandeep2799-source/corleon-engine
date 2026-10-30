# Binance Phase 2: private portfolio monitoring and risk evaluation

## Scope delivered

- Private Spot account snapshot through signed `GET /api/v3/account`.
- Server-only HMAC-SHA256 request signing with a 5,000 ms `recvWindow`.
- Non-zero balance filtering and `Cache-Control: no-store`.
- Service-to-service bearer authorization for private monitoring and risk routes.
- Deterministic Spot order proposal assessment with a symbol allowlist and per-order USDT notional ceiling.
- Live execution remains hard-disabled. A positive risk result is explicitly simulation-only.

## Endpoints

### Public market data

`GET /api/integrations/binance/market?symbol=BTCUSDT`

### Private portfolio snapshot

`GET /api/integrations/binance/account`

Requires `Authorization: Bearer <BINANCE_MONITORING_ACCESS_TOKEN>`.

### Risk assessment

`POST /api/integrations/binance/risk/evaluate`

Requires the same service bearer token and JSON:

```json
{
  "symbol": "BTCUSDT",
  "side": "BUY",
  "quantity": 0.0001,
  "referencePrice": 60000
}
```

A successful assessment returns `APPROVED_FOR_SIMULATION_ONLY`, never live execution authorization.

## Server environment

Configure these as encrypted server-side environment variables in Vercel for the web application:

```dotenv
BINANCE_MARKET_DATA_ENABLED=true
BINANCE_ACCOUNT_MONITORING_ENABLED=false
BINANCE_RISK_ENGINE_ENABLED=false
BINANCE_API_KEY=
BINANCE_API_SECRET=
BINANCE_MONITORING_ACCESS_TOKEN=
BINANCE_RISK_ALLOWED_SYMBOLS=BTCUSDT,ETHUSDT,BNBUSDT
BINANCE_RISK_MAX_ORDER_NOTIONAL_USDT=25
```

Do not place secrets in `NEXT_PUBLIC_*` variables, source files, GitHub Actions logs, browser code, or chat. Create an HMAC API key for this implementation (the current signer uses HMAC-SHA256) with only Spot `USER_DATA` permission for this monitoring phase. Do not use an Ed25519 or RSA key with this HMAC signer. Disable withdrawals, transfers, margin and futures permissions. Apply IP restrictions where supported; serverless egress must be stable/allowlisted before relying on IP restrictions.

The service bearer token is a separate Corleon-to-service credential. Generate a high-entropy random value and store it only in the caller's server-side secret store and Vercel environment. Do not expose it to browser JavaScript.

## Important execution boundary

This phase does **not** place orders. The current repository has no confirmed authenticated user/org authorization layer, durable order-intent/idempotency store, daily P&L ledger, exposure aggregation, exchange filter validation, or order reconciliation workflow. A stateless Next.js route must not pretend to enforce daily loss or portfolio-wide risk limits without durable state.

Before enabling live automated execution, implement:
1. Authenticated user and organization RBAC, with a dedicated trading service identity.
2. PostgreSQL/Prisma persistence for order intents, idempotency keys, fills, balances, daily realized/unrealized P&L, and risk decisions.
3. Atomic daily-loss, per-symbol, aggregate exposure, and order-count controls.
4. Exchange `exchangeInfo` filter validation (PRICE_FILTER, LOT_SIZE, MIN_NOTIONAL/NOTIONAL, and applicable filters).
5. Explicit allowlisted Spot symbols and order types; no margin, futures, leverage, withdrawals, or transfers.
6. A dedicated worker with controlled static egress, durable queue, retry classification, and reconciliation against order/user-data events.
7. Testnet and fault-injection tests; fail closed on stale market data, unknown order state, missing balance snapshot, database outage, or clock drift.
8. Kill switch, per-account caps, alerting, immutable audit trail, and an operational rollback/revocation runbook.

Do not toggle a live trading flag until all of the above are implemented and reviewed. The user's requested policy is automated execution **after** risk approval; the implementation must make that approval deterministic, durable, and account-aware before it can safely be connected to a live TRADE key.

## Binance references

- [Spot REST API security and signed requests](https://developers.binance.info/en/docs/products/spot/rest-api)
- [Official Spot API documentation and filters](https://github.com/binance/binance-spot-api-docs)
- [User Data Streams](https://github.com/binance/binance-spot-api-docs/blob/master/user-data-stream.md)
