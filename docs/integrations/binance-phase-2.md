# Binance Phase 2: portfolio monitoring and deterministic risk assessment

## Existing integration surface

This phase extends the existing Corleon Binance integration. It deliberately reuses the established portfolio bearer-token gate and paper-trading settings rather than introducing parallel credentials or flags.

### Public market data

`GET /api/integrations/binance/market?symbol=BTCUSDT`

Public 24-hour Spot ticker data. No credentials are used.

### Private portfolio

`GET /api/integrations/binance/portfolio`

Requires `Authorization: Bearer <BINANCE_PORTFOLIO_ACCESS_TOKEN>` and `BINANCE_PRIVATE_API_ENABLED=true`.

The route uses signed `GET /api/v3/account` with server-side HMAC-SHA256 signing, a 5,000 ms `recvWindow`, and `Cache-Control: private, no-store`. It returns non-zero Spot balances and indicative USDT pricing for at most 20 assets with a direct `ASSETUSDT` market. This is not full account NAV and excludes unsupported pairs and other Binance products.

### Paper-trade preview

`POST /api/integrations/binance/paper-trades`

Requires the same bearer token and `BINANCE_PAPER_TRADING_ENABLED=true`. It fetches a current public ticker, applies the shared deterministic risk policy, and returns a simulation preview. No exchange order is submitted.

### Risk assessment

`POST /api/integrations/binance/risk/evaluate`

Requires the same bearer token and paper-trading feature flag. JSON body:

```json
{
  "symbol": "BTCUSDT",
  "side": "BUY",
  "quantity": 0.0001,
  "referencePrice": 60000
}
```

A passing result is `APPROVED_FOR_SIMULATION_ONLY`. It is not a live execution authorization.

## Server environment

The root `.env.example` already defines the integration settings:

```dotenv
BINANCE_MARKET_DATA_ENABLED=false
BINANCE_PRIVATE_API_ENABLED=false
BINANCE_API_KEY=
BINANCE_API_SECRET=
BINANCE_PORTFOLIO_ACCESS_TOKEN=
BINANCE_PAPER_TRADING_ENABLED=false
BINANCE_PAPER_ALLOWED_SYMBOLS=BTCUSDT,ETHUSDT,BNBUSDT
BINANCE_PAPER_MAX_NOTIONAL_USDT=100
```

For the current signer, create a Binance HMAC API key with Spot `USER_DATA` permission only. Do not use an Ed25519 or RSA key with this HMAC signer. Disable trading, withdrawals, transfers, margin and futures permissions. Apply IP restrictions where supported; Vercel serverless egress is not inherently static.

Store the API key, secret, and high-entropy portfolio bearer token only in server-side Vercel environment variables or a managed secret store. Never use `NEXT_PUBLIC_*`, commit populated values, send them from browser JavaScript, or paste them into chat. The bearer token is a deployment-level service gate, not a substitute for per-user/org authentication and tenant authorization.

## Live execution boundary

The user's desired policy is automated execution after deterministic risk approval. Live exchange execution is **not enabled in this phase**. The current implementation only supports portfolio reads, risk evaluation, and paper-trade previews.

Before enabling a live `TRADE` key or submitting orders, implement and verify:
1. Authenticated user/org RBAC and tenant-scoped credential management.
2. PostgreSQL/Prisma persistence for order intents, idempotency keys, fills, balance snapshots, risk decisions, and daily P&L.
3. Atomic per-order, per-symbol, aggregate-exposure, order-count, and daily-loss controls.
4. Binance `exchangeInfo` filter validation (PRICE_FILTER, LOT_SIZE, MIN_NOTIONAL/NOTIONAL and all applicable filters).
5. A durable execution worker with controlled static egress, retry classification, and order-state reconciliation.
6. Fail-closed behavior for stale quotes, unknown order state, missing account snapshots, clock drift, and database/queue failures.
7. Testnet and fault-injection coverage, a kill switch, alerting, immutable audit trail, and key-revocation runbook.
8. Legal/product review for the exact Indian account, product and business use.

Do not add or enable live order submission until these requirements are implemented and reviewed. Risk-agent/model output must never independently authorize an order.

## Binance references

- [Spot REST API security and signed requests](https://developers.binance.info/en/docs/products/spot/rest-api)
- [Official Spot API documentation and filters](https://github.com/binance/binance-spot-api-docs)
- [User Data Streams](https://github.com/binance/binance-spot-api-docs/blob/master/user-data-stream.md)
