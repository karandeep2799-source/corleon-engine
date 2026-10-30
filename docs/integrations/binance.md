# Binance integration

## Current implementation

The web application exposes a server-side public Spot market-data endpoint:

`GET /api/integrations/binance/market?symbol=BTCUSDT`

It returns Binance's 24-hour ticker statistics for one symbol. The implementation uses Binance's market-data-only REST host (`https://data-api.binance.vision`), validates the symbol, applies a five-second request timeout, handles upstream throttling, and configures short-lived shared caching.

This first phase is deliberately **public-data only**. It does not read account balances, orders, deposits, withdrawals, or user data. It cannot place or cancel trades. No API key or secret is required.

## Enable locally and on Vercel

Set this server-only environment variable:

```dotenv
BINANCE_MARKET_DATA_ENABLED=true
```

Keep it unset or set it to `false` to disable the endpoint. Configure it in the Vercel project for the `@corleon/web` application and redeploy.

## Example

```bash
curl "http://localhost:3000/api/integrations/binance/market?symbol=BTCUSDT"
```

The endpoint defaults to `BTCUSDT` when no symbol is supplied. Symbols are normalized to uppercase and validated before being sent upstream.

## Next integration phases

1. **Read-only account data:** add a separately stored API credential with only the minimum account-read permission supported by the Binance account/API product available to the user. Require IP restrictions where supported. Never enable withdrawals.
2. **Streaming:** run a dedicated long-lived worker for public WebSocket market streams. Do not keep exchange WebSocket connections inside Vercel request handlers. Reconnect before/after Binance's documented 24-hour connection lifetime and handle ping/pong frames.
3. **AI intelligence:** persist normalized market snapshots and agent analyses separately. Treat model output as advisory, cite source timestamps, and require deterministic risk checks before any action.
4. **Execution (not enabled):** only consider after jurisdiction/product availability, account permissions, testnet validation, idempotency, order-state reconciliation, limits, audit trails, and explicit human approval have been reviewed.

## Security requirements for any future private API connection

- Never paste API keys, secrets, private keys, or signed request URLs into chat, source control, issue trackers, or client-side code.
- Store credentials in a managed secret store or encrypted server-side credential vault. Do not use `NEXT_PUBLIC_*` variables for secrets.
- Use separate keys for account reads and trading if the product supports it.
- Start with read-only permissions; disable withdrawals and transfers.
- Restrict keys to fixed egress IPs when available. Vercel serverless egress IPs are not inherently static; use a controlled worker/egress layer if IP allowlisting is required.
- Sign requests only in server-side code, use a small `recvWindow`, synchronize clocks, redact credentials/signatures from logs, and rotate/revoke keys promptly if exposed.
- Apply per-user authorization, rate limits, request validation, audit logging, and anomaly alerts to all private endpoints.

## India-specific operational note

Binance's FIU-IND registration is not a blanket legal opinion that every product, API capability, or automated trading strategy is available or suitable for every Indian user. Verify current product availability and applicable Indian tax, AML, reporting, and exchange terms before enabling account access or execution. Seek qualified advice for the platform's exact activity and business model.

## Operational references

- [Binance Spot REST API documentation](https://developers.binance.info/en/docs/products/spot/rest-api)
- [Official Binance Spot API and Streams documentation](https://github.com/binance/binance-spot-api-docs)
- [Binance WebSocket market streams](https://github.com/binance/binance-spot-api-docs/blob/master/web-socket-streams.md)
- [Binance API key types](https://github.com/binance/binance-spot-api-docs/blob/master/faqs/api_key_types.md)
- [FIU-IND Binance order](https://fiuindia.gov.in/pdfs/judgements/Binance_Order_10_2024.pdf)
