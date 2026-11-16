# Corleon Wallet Intelligence

## Scope and security

Wallet Intelligence is a read-only EVM portfolio viewer backed by Blockscout. It uses the public Blockscout supported-chain registry, queries address metadata and token holdings, and exposes transaction history through a separate route.

It does not connect to a wallet provider and contains no private-key, seed phrase, signing, transaction submission, token approval, swap, or transfer code.

The configured default address is the public address supplied for this integration. Override it with `BLOCKSCOUT_DEFAULT_ADDRESS` when needed.

## Provider strategy

- **Blockscout Pro:** when `BLOCKSCOUT_PRO_API_KEY` is configured, requests use the unified `https://api.blockscout.com/{chain_id}/api/v2` gateway with Bearer authentication.
- **Public explorer fallback:** when Pro is not configured, or a Pro request fails and fallback is enabled, the module uses the per-chain API URL from the Blockscout registry.
- **Registry:** `https://api.blockscout.com/api/json/config` is cached for five minutes. The adapter tolerates common chain-registry field names and rejects unrecognized entries rather than guessing.
- **No key in browser:** Pro credentials are read only in server-side code and are never returned by an API route.

Public instance availability, API limits and chain coverage vary. A chain may appear in the registry but fail to answer at query time; those failures are reported per chain and do not discard successful results from other networks.

## Environment

Add these variables to the local environment or Vercel Preview environment. Do not commit populated secrets.

```dotenv
BLOCKSCOUT_PRO_API_KEY=
BLOCKSCOUT_PRO_API_BASE_URL=https://api.blockscout.com
BLOCKSCOUT_PUBLIC_FALLBACK=true
BLOCKSCOUT_DEFAULT_ADDRESS=0xd6eCCeBC1a33f10b432cd5896554182411D840dF
```

A free Pro account/key may be used where available. The public fallback does not require a Pro key, but depends on the individual explorer's public API policy and uptime. Never put the Pro key in a `NEXT_PUBLIC_*` variable.

## Routes

- `GET /api/integrations/blockscout/chains` — supported chain registry.
- `GET /api/integrations/blockscout/portfolio?address=0x...` — address metadata and token holdings across supported networks. Optional `chains=1,8453` limits the scan.
- `GET /api/integrations/blockscout/activity?address=0x...&chainId=1` — first page of indexed transactions for one supported chain. Pass `cursor` for pagination.

The portfolio endpoint scans in batches of six and caps explicit chain selections at 120. It has a best-effort in-process request limiter (20 requests per minute per forwarded IP). This limiter is not globally consistent across serverless instances; for public production traffic, place a durable edge/WAF rate limit in front of these routes.

## Local development and verification

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @corleon/web test
pnpm --filter @corleon/web typecheck
pnpm --filter @corleon/web lint
pnpm --filter @corleon/web build
```

Open `/wallet-intelligence` locally to use the dashboard. The default wallet is public address data only. No production deployment or environment changes are performed by this implementation.

## Data interpretation

- Native balances are returned in base units (wei-like integer strings) and formatted in the UI using 18 decimals. The current UI uses the common 18-decimal convention for native EVM assets; chain-specific native decimals should be supplied by the registry before treating displayed amounts as accounting-grade.
- ERC token balances use token decimals supplied by the explorer.
- Explorer indexing can lag chain state.
- Token USD values are intentionally not aggregated into a portfolio total; price coverage and liquidity can be incomplete.
