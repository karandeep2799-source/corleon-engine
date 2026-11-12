# WEEGLOO integration

Corleon Engine exposes a guarded, read-only bridge to the WEEGLOO remote MCP server. It uses the existing Next.js App Router and does not add a second database, install an SDK, or change the Prisma schema.

## Scope and safety

- Remote MCP endpoint: https://ai.weegloo.com/mcp
- Supported MCP groups: default, core, extra, all.
- Authentication: a WEEGLOO OAuth bearer access token is passed per request by a trusted server-side caller.
- Corleon gateway authentication: x-corleon-integration-key.
- WEEGLOO credential header: x-weegloo-access-token.
- Tool discovery is enabled after the integration is enabled.
- Tool execution is limited to exact names in WEEGLOO_READ_ONLY_TOOLS.
- Mutating tool names are blocked even if mistakenly added to the allowlist.
- No OAuth tokens, Personal Access Tokens, or integration secrets are persisted by this module.
- No WEEGLOO resources are created, modified, deleted, published, or deployed by this implementation.

The repository currently has no application-wide user session or OAuth token-vault abstraction. This module therefore deliberately accepts a short-lived OAuth access token from a trusted server-side credential broker instead of introducing an insecure browser token store. The credential broker must perform WEEGLOO's MCP-standard OAuth flow and refresh/rotate credentials as appropriate.

The separate WEEGLOO upload server is not proxied by this module. It uses a local stdio process and a Personal Access Token, unlike the remote OAuth MCP server.

## Configuration

Add the following server-side environment variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| WEEGLOO_ENABLED | Yes | Must be exactly true to enable requests. Default false. |
| WEEGLOO_MCP_URL | No | Defaults to https://ai.weegloo.com/mcp. Only ai.weegloo.com/mcp over HTTPS is accepted. |
| WEEGLOO_READ_ONLY_TOOLS | Yes for tool calls | Comma-separated exact tool names approved for read-only execution. Start empty. |
| CORLEON_INTEGRATION_API_KEY | Yes | High-entropy server-to-server gateway key. |

Do not put credentials in NEXT_PUBLIC_* variables, source control, browser storage, query strings, or logs. Configure secrets only in the deployment provider's secret manager after review. Keep WEEGLOO_ENABLED=false until the OAuth broker and gateway caller have been verified.

## API

All requests require x-corleon-integration-key. POST requests also require x-weegloo-access-token.

### Inspect integration status

GET /api/integrations/weegloo

### Discover tools

POST /api/integrations/weegloo

```json
{ "operation": "tools/list" }
```

The response contains the MCP server's tool metadata. Review the exact tool names and confirm their semantics before adding any name to WEEGLOO_READ_ONLY_TOOLS.

### Call an approved read-only tool

POST /api/integrations/weegloo

```json
{
  "operation": "tools/call",
  "name": "cda_GetContent",
  "arguments": { "id": "content-id" }
}
```

The example tool name is illustrative. Use only a real tool name returned by tools/list and verified as read-only. Calls to unapproved or mutating tools return HTTP 403.

## Security and operations

- The internal key is compared using a constant-time comparison.
- The MCP endpoint is pinned to the official WEEGLOO HTTPS host to prevent SSRF.
- MCP calls use a 15-second timeout and a 2 MiB response limit.
- OAuth bearer tokens are never written to logs.
- Tool names and allow/deny decisions are logged without request arguments.
- Tool writes, uploads, scripts, webhooks, schedules, and hosting deployments remain blocked.
- The route does not expose the internal key or OAuth token in its response.
- The endpoint is server-to-server only; do not call it directly from an untrusted browser.

## Enabling writes later

Do not add mutating tool names to the read-only allowlist. Enabling writes requires integration with Corleon's durable approval workflow, organization/space selection, actor identity, idempotency, and audit persistence. This release intentionally does not bypass those controls.

## Verification

Run from the repository root:

```bash
pnpm --filter @corleon/web test -- --run
pnpm --filter @corleon/web typecheck
pnpm --filter @corleon/web lint
pnpm build
```

No deployment, production configuration change, remote WEEGLOO resource mutation, or database migration is part of this integration.
