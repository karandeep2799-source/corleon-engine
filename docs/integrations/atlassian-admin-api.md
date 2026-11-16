# Atlassian Organization Admin API

This integration adds a server-side, read-only gateway to the Atlassian Organization Administration API.

## Scope

Supported resources:
- Organizations and organization details
- Domains
- Directories
- Managed accounts
- Directory user search
- Audit events and event polling
- Organization policies (read only)

The current implementation deliberately does not expose user invitations, role assignment/revocation, suspensions, group membership changes, policy writes, unit creation, or destructive operations.

## Configuration

Set these variables only in the server-side secret manager:

| Variable | Required | Default |
|---|---:|---|
| `ATLASSIAN_ADMIN_API_ENABLED` | No | `false` |
| `ATLASSIAN_ADMIN_API_KEY` | Yes when enabled | unset |
| `ATLASSIAN_ORG_ID` | No | unset |
| `CORLEON_ATLASSIAN_ROUTE_TOKEN` | Yes when enabled | unset |

Never expose either token through a `NEXT_PUBLIC_*` variable. Do not commit populated environment files.

## Endpoint

`GET /api/integrations/atlassian/admin?resource=organizations`

For organization-scoped resources, supply `orgId` or configure `ATLASSIAN_ORG_ID`.

Examples:
- `?resource=domains`
- `?resource=directories`
- `?resource=users`
- `?resource=users&directoryId=...&searchTerm=alex`
- `?resource=events`
- `?resource=events-stream`
- `?resource=policies`

Every request requires:
`Authorization: Bearer <CORLEON_ATLASSIAN_ROUTE_TOKEN>`

Responses are private and non-cacheable. The API key is sent only from the server to `https://api.atlassian.com/admin`. Rate-limit responses preserve Atlassian's `Retry-After` header.

## Authorization and operational safety

- Start with the minimum Atlassian scopes needed for the selected read resources.
- The internal route token is independent from the Atlassian API key.
- Keep the feature flag disabled until credentials and permissions have been verified.
- The integration fails closed when disabled or unconfigured.
- No administrative write operation is exposed by this route.
- Audit ingestion persistence, write workflows, approvals, and organization-specific RBAC require a separate reviewed implementation phase.

## Verification

Run from the repository root:

```bash
pnpm --filter @corleon/web typecheck
pnpm --filter @corleon/web test
pnpm build
```

Do not enable the feature in production until the checks pass and a read-only connection has been verified against a non-production or explicitly approved Atlassian organization.
