# Corleon Blockchain Intelligence — Blockscout

## Scope

The Blockscout integration provides read-only EVM explorer data inside Corleon Engine:

- Supported mainnet discovery through the Blockscout chain registry.
- Native asset balances and token holdings for a public wallet address.
- Address transaction and token-transfer activity.
- Multi-chain requests with bounded fan-out.
- A Next.js dashboard at /wallet-intelligence.

It does not connect wallets, request signatures, store private keys, approve tokens, broadcast transactions, swap assets, bridge funds, or execute trades.

## Architecture

Browser -> Next.js route handlers -> validation and rate limiting -> Blockscout PRO API -> indexed blockchain data.

The integration uses the unified Blockscout PRO API. It does not accept arbitrary explorer base URLs from requests or registry responses, preventing user-controlled upstream hosts and SSRF.

## Configuration

Create a Blockscout PRO API key at https://dev.blockscout.com/. Store it only in the server environment.

Required:
- BLOCKSCOUT_PRO_API_KEY: Blockscout PRO API key. Never expose it through a NEXT_PUBLIC_ variable or commit it.

Optional:
- BLOCKSCOUT_DEFAULT_CHAIN_IDS: comma-separated default chain IDs. Defaults to Ethereum, Optimism, Base, Arbitrum One, Gnosis and Polygon.
- BLOCKSCOUT_MAX_CHAINS_PER_REQUEST: maximum networks per portfolio request (1–12; default 6).
- UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN: distributed rate-limit storage. If configured but unavailable, requests fail closed with HTTP 503.

Add the key to Vercel Project Settings -> Environment Variables for Preview first. Do not add it to GitHub, source files, client variables or chat messages. Keep the feature unavailable until the key is configured.

## API

GET /api/integrations/blockscout/chains
Returns supported mainnet metadata. Cached for five minutes.

POST /api/integrations/blockscout/portfolio
Request JSON: { "address": "0x...", "chainIds": ["1", "10", "8453"] }
Returns native balances, token holdings, transaction counters and per-chain errors. The route caps network fan-out and applies a per-IP request limit.

POST /api/integrations/blockscout/activity
Request JSON: { "address": "0x...", "chainId": "1", "cursor": null }
Returns recent normal transactions and token transfers. Pagination cursors are bounded and filtered to known Blockscout cursor fields.

## Rate limiting and production operations

Without Upstash, the route uses a best-effort in-memory per-instance limit. This is a local safeguard, not a global quota across Vercel serverless instances. For broad public production exposure, configure Upstash Redis or Vercel Firewall rate limiting before opening the dashboard to unauthenticated traffic.

Monitor Blockscout PRO API credit usage and RPS in the developer portal. Keep the selected chain count conservative and handle HTTP 401/403/429 responses without retry storms.

## Data limitations

- Explorer data is indexed data and may lag the underlying chain.
- Native balances are returned in base units and formatted client-side.
- Token prices are not guaranteed to be present or current; no portfolio valuation is inferred.
- A wallet may have activity on networks not currently indexed by Blockscout.
- This dashboard is informational, not tax, compliance, legal or investment advice.

## Verification

Run from the repository root:

    pnpm install --frozen-lockfile
    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build

The Blockscout routes return HTTP 503 until BLOCKSCOUT_PRO_API_KEY is configured. No production secret or deployment setting is changed by this code change.
