# Corleon Infrastructure Intelligence — Cloudflare Zone Analytics

This module provides a read-only Cloudflare GraphQL Analytics integration for one configured zone.

## Included

- Protected server-side endpoint: `GET /api/integrations/cloudflare/analytics?range=24h`
- Supported windows: `24h`, `7d`, `30d` (unknown values safely default to `24h`)
- Aggregate requests, response bytes, visits, edge HTTP status breakdown, and cache status breakdown
- Server-rendered connector status page: `/infrastructure/cloudflare`
- Normalization tests for time windows, aggregate metrics, provider errors, and empty zone results

The query uses `httpRequestsAdaptiveGroups` and filters `requestSource: "eyeball"` to focus on end-user traffic. It intentionally does not request client IP addresses, user agents, raw logs, DNS records, or any write-capable Cloudflare APIs.

## Required Vercel environment variables

Set these as server-only environment variables for the intended environment:

| Variable | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with GraphQL Analytics read access |
| `CLOUDFLARE_ZONE_ID` | The exact zone identifier to query |
| `CORLEON_CLOUDFLARE_ANALYTICS_KEY` | High-entropy secret used to authorize calls to the Corleon endpoint |

Never prefix these values with `NEXT_PUBLIC_`. Do not commit populated values, paste them into source code, or send them through chat.

### Cloudflare token scope

Create a custom API token using Cloudflare's GraphQL Analytics token workflow. Grant **Account → Account Analytics → Read**, and scope Zone Resources to only the required zone(s). Do not grant DNS Write, Zone Write, Cache Purge, Firewall Write, or other mutation permissions.

Official instructions: https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/

## Request

```http
GET /api/integrations/cloudflare/analytics?range=24h
Authorization: Bearer <CORLEON_CLOUDFLARE_ANALYTICS_KEY>
```

Example success response:

```json
{
  "ok": true,
  "data": {
    "zone": "configured-zone-id",
    "range": "24h",
    "generatedAt": "2026-11-16T12:00:00.000Z",
    "window": {
      "start": "2026-11-15T12:00:00.000Z",
      "end": "2026-11-16T12:00:00.000Z"
    },
    "requests": 12345,
    "responseBytes": 987654321,
    "visits": 2345,
    "averageSampleInterval": 1,
    "statusBreakdown": [{ "status": "200", "requests": 12000 }],
    "cacheBreakdown": [{ "status": "hit", "requests": 9000 }]
  }
}
```

## HTTP behavior

- `401`: missing or invalid Corleon bearer key
- `502`: Cloudflare upstream request or GraphQL query failed
- `503`: required server-side configuration is missing or endpoint is disabled
- Successful and error responses use no-store cache headers.
- Provider error details and secrets are not returned to API clients.

The bearer-key comparison uses constant-time byte comparison. The route has no write capability. Add an edge/WAF rate limit to this endpoint before enabling access beyond trusted server-to-server callers; Cloudflare's GraphQL API has per-user and per-zone budgets, and the application does not pretend that an in-memory limiter is globally consistent across serverless instances.

## Operational limits and interpretation

- Adaptive HTTP datasets retain at least 31 days of data on every plan; the connector caps its supported range at 30 days.
- The GraphQL API default quota is 300 queries per five-minute window and at least one query per second. This integration combines its three aggregate views into one GraphQL request.
- `requests` counts HTTP requests, not page views.
- `visits` is Cloudflare's visit measure, not a unique-person count.
- `responseBytes` is response data transfer.
- Worker subrequests are not included in ordinary zone Traffic Analytics; investigate those in Workers analytics.
- Data availability and fields can vary by plan and zone configuration.

References:
- https://developers.cloudflare.com/analytics/account-and-zone-analytics/zone-analytics/
- https://developers.cloudflare.com/analytics/graphql-api/limits/
- https://developers.cloudflare.com/analytics/graphql-api/migration-guides/graphql-api-analytics/

## Deployment and security checklist

1. Configure the three variables in Vercel Preview first.
2. Create a dedicated high-entropy Corleon bearer key; store it only in Vercel.
3. Add an edge/WAF rate limit to the endpoint before exposing it to any browser-facing application.
4. Call the endpoint from a trusted server-side client and verify the response.
5. Run lint, typecheck, test, and build checks.
6. Review the preview deployment and route behavior.
7. Promote to production only after explicit approval.

No Cloudflare DNS, firewall, cache, billing, or production settings are modified by this integration.
