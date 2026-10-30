# Binance integration

## Phase 1: public Spot market data

`GET /api/integrations/binance/market?symbol=BTCUSDT` returns one Spot 24-hour ticker from Binance's market-data-only REST host (`https://data-api.binance.vision`). The route validates symbols, uses a five-second timeout, handles throttling, and applies short-lived shared caching.

Enable with `BINANCE_MARKET_DATA_ENABLED=true`. No credentials are used.

## Phase 2: read-only portfolio monitoring

`GET /api/integrations/binance/portfolio` retrieves a Spot account snapshot using a server-side signed `GET /api/v3/account` USER_DATA request. It returns non-zero balances and an indicative USDT valuation for at most the first 20 assets with a direct `ASSETUSDT` ticker. Unsupported pairs and assets outside that bound are explicitly excluded; valuation is not a full account NAV and does not include other Binance products, liabilities, funding, earn, margin or futures.

Enable only after configuring all of the following in the server-side secret manager:
- `BINANCE_PRIVATE_API_ENABLED=true`
- `BINANCE_API_KEY`: a dedicated Binance Spot key with USER_DATA permission only
- `BINANCE_API_SECRET`: corresponding secret
- `BINANCE_PORTFOLIO_ACCESS_TOKEN`: a separate high-entropy bearer token used by Corleon's private route gate

The route returns `401` without the bearer token and `503` while disabled. Send the token as `Authorization: Bearer <token>`. Do not send credentials from a browser or store them in a `NEXT_PUBLIC_*` variable.

Example (run locally; do not paste real credentials into shell history or chat):
```bash
curl -H "Authorization: Bearer $BINANCE_PORTFOLIO_ACCESS_TOKEN" \
  http://localhost:3000/api/integrations/binance/portfolio
```

This phase uses a single shared bearer gate as a deployment safeguard, not a substitute for Corleon's eventual per-user authentication, authorization, credential vault, tenant isolation, and audit trail. Do not expose this route to multiple users until those controls are implemented. For Vercel deployments, fixed-IP allowlisting may require a controlled-egress worker; serverless egress is not inherently static.

## Phase 3: paper-trading preview only

`POST /api/integrations/binance/paper-trades` returns a deterministic simulation preview using the latest 24-hour ticker last price, a configurable per-trade notional ceiling, and explicit fee/slippage assumptions. It does not submit, amend, or cancel exchange orders. It is not yet a persisted paper-trade ledger.

Enable with `BINANCE_PAPER_TRADING_ENABLED=true`. The route uses the same bearer gate. Defaults:
- Allowed symbols: `BTCUSDT,ETHUSDT,BNBUSDT`
- Maximum notional: `100` USDT
- Simulated slippage: 5 bps
- Simulated fee: 10 bps

Example:
```bash
curl -X POST \
  -H "Authorization: Bearer $BINANCE_PORTFOLIO_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT","side":"BUY","quantity":0.001}' \
  http://localhost:3000/api/integrations/binance/paper-trades
```

Every response identifies `mode: PAPER`, `liveExecution: false`, and `exchangeOrderSubmitted: false`. There is no live-order client or order endpoint in this phase.

## Environment variables

See the repository root `.env.example`. All private flags default to `false`. Set the values only in local untracked environment files or the deployment secret manager, then redeploy. Never commit populated secrets.

## Security and operational requirements

- Create a dedicated Spot API key with USER_DATA only. Do not enable TRADE, withdrawals, or transfers.
- Never paste API keys, secrets, signed URLs, or bearer tokens into chat, source control, issue trackers, client-side code, or logs.
- Keep credentials server-only; sign requests in Node runtime with a short `recvWindow`; redact signatures and authorization headers.
- Restrict API key IPs where possible. Vercel serverless egress is not inherently static; use controlled egress if Binance IP restrictions require it.
- Add real user authentication, tenant-scoped credential storage, rate limits, audit logging, alerting, and secret rotation before multi-user production exposure.
- Do not treat model output as an execution authority. Any future live execution requires a separate explicitly approved project phase, deterministic risk checks, testnet coverage, idempotency, order reconciliation, kill switch, and legal/product review.

## Streaming architecture note

Do not keep exchange WebSocket connections inside Vercel request handlers. Use a dedicated long-lived worker for market streams. Binance Spot user-data streams have moved away from the legacy listenKey lifecycle; the current authenticated WebSocket API subscription flow has Ed25519-specific requirements. This implementation deliberately uses REST snapshots and does not claim to provide live account streaming.

## India-specific operational note

FIU-IND registration is not a blanket legal opinion that every product, API capability, or automated trading strategy is available or suitable for every Indian user. Verify current product availability and applicable Indian tax, AML, reporting, and exchange terms before enabling account access or any future execution. Seek qualified advice for the platform's exact activity and business model.

## Official references

- [Binance Spot REST API and request security](https://developers.binance.com/en/docs/products/spot/rest-api)
- [Binance Spot account USER_DATA API](https://developers.binance.com/en/docs/products/spot/rest-api/account-endpoints)
- [Binance authenticated Spot user-data WebSocket API](https://developers.binance.com/en/docs/products/spot/websocket-api/user-data-stream-requests)
- [Official Binance Spot API and Streams documentation](https://github.com/binance/binance-spot-api-docs)
- [Binance API key types](https://github.com/binance/binance-spot-api-docs/blob/master/faqs/api_key_types.md)
- [FIU-IND Binance order](https://fiuindia.gov.in/pdfs/judgements/Binance_Order_10_2024.pdf)
