# Corleon Portfolio Intelligence — Angel One

## Scope

This integration retrieves Angel One SmartAPI holdings and net positions for private portfolio monitoring. It is deliberately read-only.

Enabled upstream calls:

- `GET /rest/secure/angelbroking/portfolio/v1/getAllHolding`
- `GET /rest/secure/angelbroking/order/v1/getPosition`

The integration does not call order placement, modification, cancellation, position conversion, funds, payout, or withdrawal endpoints. No order-capable methods are exported by this module.

## Configuration

Set these variables in the server environment (never expose them with a `NEXT_PUBLIC_` prefix):

| Variable | Purpose |
| --- | --- |
| `ANGELONE_PRIVATE_API_ENABLED` | Must be exactly `true` to enable the route; default is disabled |
| `ANGELONE_API_KEY` | SmartAPI application API key |
| `ANGELONE_JWT_TOKEN` | Current SmartAPI JWT access token from the official login flow |
| `ANGELONE_CLIENT_LOCAL_IP` | Client local IP required by SmartAPI |
| `ANGELONE_CLIENT_PUBLIC_IP` | Client public IP required by SmartAPI |
| `ANGELONE_MAC_ADDRESS` | Client MAC address required by SmartAPI |
| `ANGELONE_SOURCE_ID` | Optional SmartAPI source ID; defaults to `WEB` |
| `ANGELONE_PORTFOLIO_ACCESS_TOKEN` | Long random secret protecting Corleon's private portfolio route |

SmartAPI sessions expire and must be refreshed using Angel One's official authentication process. Update `ANGELONE_JWT_TOKEN` in the deployment environment when a new session is generated. Do not send API keys, PINs, TOTP seeds, JWTs, or access tokens in chat, source control, logs, or client-side code.

Generate the Corleon route access token with a password manager or a cryptographically secure generator (for example, `openssl rand -base64 48`). Store it only as a server environment variable. The route requires it as a Bearer token.

## API

`GET /api/integrations/angelone/portfolio`

Headers:

```http
Authorization: Bearer <ANGELONE_PORTFOLIO_ACCESS_TOKEN>
```

The route returns holdings, aggregate holding valuation when supplied by Angel One, positions, retrieval time, and an explicit capability policy. Responses are marked `private, no-store`.

## Operational safeguards

- Disabled unless `ANGELONE_PRIVATE_API_ENABLED=true`.
- Server-side secrets only; never use public environment variables for credentials.
- Constant-time comparison for the Corleon access token.
- Request timeout, bounded error messages, upstream status handling, and response-shape validation.
- No raw upstream response, authorization header, JWT, or API key is logged.
- No order execution or position conversion capability.
- Do not deploy or enable the integration until credentials, IP/MAC header values, account access, and the intended operator have been verified.

## Verification

Run from the repository root:

```bash
pnpm --filter @corleon/web test -- lib/angelone/portfolio.test.ts
pnpm --filter @corleon/web typecheck
pnpm --filter @corleon/web build
```

The included test covers route bearer-token authorization. Live API verification requires valid SmartAPI credentials and an active session; it is not performed by unit tests.
