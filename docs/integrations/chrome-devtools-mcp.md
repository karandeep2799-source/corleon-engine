# Chrome DevTools MCP integration

**Status:** Local development integration; production worker not enabled  
**Upstream:** https://github.com/ChromeDevTools/chrome-devtools-mcp  
**Upstream package:** `chrome-devtools-mcp@1.12.0`  
**Reviewed:** 2026-11-10

## Purpose

Chrome DevTools MCP gives Corleon agents browser diagnostics and automation through the official Chrome DevTools Model Context Protocol server. Corleon consumes it as an external stdio MCP server; it does not embed Chromium in Next.js or run a browser inside a Vercel Function.

The integration is intentionally split into:

- `config/mcp/chrome-devtools-server.json`: conservative upstream server configuration.
- `src/mcp/chrome-devtools.js`: pinned server definition and mapping from upstream tool names to Corleon policy IDs.
- `src/mcp/policy.js`: default-deny/approval policy.
- `apps/web/lib/mcp/chrome-devtools-policy.test.ts`: policy and configuration regression tests.

## Enabled capabilities

The default profile enables navigation, performance, network and debugging categories, with browser input disabled. It supports page discovery, snapshots, screenshots, console/network inspection and performance diagnostics.

The default profile disables:

- Click, fill, keyboard, drag and other input tools.
- Arbitrary JavaScript evaluation.
- Experimental DevTools target access and coordinate-based vision.
- Third-party page tools and WebMCP execution.
- Browser extensions, PWA mutations, WebAuthn and heap-snapshot inspection.
- Insecure TLS certificate acceptance.

Network headers are redacted. Browser sessions are headless and isolated, and page IDs are required for page-scoped tools.

## Local setup

Requirements: Node.js 22.12+ (Corleon uses Node.js 24), npm/npx, and a supported Google Chrome or Chrome for Testing installation.

The repository Codex project configuration declares the pinned MCP server. From a trusted developer workstation:

```bash
npx --yes chrome-devtools-mcp@1.12.0 --config=config/mcp/chrome-devtools-server.json --no-javascript-evaluation --no-usage-statistics --no-update-checks --no-performance-crux
```

The MCP client should launch this command using stdio transport. Do not expose the process over an unauthenticated HTTP endpoint.

For local testing of `localhost`, create a separate developer-only config outside the committed default profile and explicitly remove the loopback block only for that trusted local test. Never relax metadata-service blocks or production egress controls.

## Corleon policy mapping

Upstream tool names are mapped to stable Corleon policy IDs in `src/mcp/chrome-devtools.js`.

| Tool class | Corleon policy | Default |
|---|---|---|
| Page list, snapshots, screenshots | `browser.*.read` | Allow |
| Console, styles, network, performance diagnostics | `browser.*.read` | Allow |
| Navigation and page lifecycle | `browser.navigation.navigate` | Approval required |
| Click, fill, keyboard and drag | `browser.input.interact` | Approval required |
| Heap snapshots | `browser.memory.inspect` | Approval required |
| File upload | `browser.file.upload` | Deny |
| Arbitrary JavaScript | `browser.script.evaluate` | Deny |
| Extensions, third-party tools and WebMCP execution | `browser.*` | Deny |
| Unknown upstream tool | `browser.unknown` | Deny |

**Important:** the policy mapping is a Corleon authorization contract, not a security boundary when a developer connects directly to the upstream server. Production calls must pass through a Corleon-controlled MCP gateway that authenticates the actor, resolves tenant/session ownership, applies `authorizeChromeDevToolsTool`, enforces approval, and records audit receipts. Do not give production agents direct access to the upstream server.

## Production architecture requirements

Before enabling a browser worker:

1. Run Chrome DevTools MCP in a separately deployed, isolated container/worker, never in a Next.js request handler or Vercel Function.
2. Allocate one browser context per tenant/task; do not reuse profiles or cookies across users.
3. Keep Chromium sandboxing enabled. Do not add `--no-sandbox`.
4. Enforce network egress restrictions outside Chrome. Block loopback, RFC1918, link-local, cloud metadata, internal DNS zones and unapproved destinations, including redirects and subresources. The committed URL patterns are defense-in-depth only, not a complete SSRF control.
5. Keep the MCP config and its parent directory read-only to the agent. The upstream documentation warns that writable config can change executable paths and URL restrictions.
6. Put any authenticated browser credentials in a managed secret store; never place cookies, tokens, WebSocket endpoints or browser profiles in Git, prompts or audit events.
7. Require a human approval bound to the exact target and action digest for navigation to sensitive destinations, input, account changes and transactions.
8. Apply CPU, memory, process, request, response, navigation and wall-clock limits. Support cancellation and guaranteed context cleanup.
9. Treat page content, console output and network response bodies as untrusted data; never interpret them as agent instructions.
10. Record actor, tenant, session, tool, policy decision, approval ID, target origin, duration and outcome. Redact headers, bodies, secrets and personal data.

The upstream server can inspect and modify browser data. Only connect it to browser sessions whose content the agent is authorized to access. Do not connect a personal browser profile or an already authenticated session by default.

## Validation

From the repository root:

```bash
pnpm --filter @corleon/web typecheck
pnpm --filter @corleon/web test
pnpm --filter @corleon/web lint
pnpm --filter @corleon/web build
```

The policy tests validate the local integration contract. A real-Chrome worker integration test, egress-control test, tenant-isolation test, cancellation test and gateway authorization contract test are still mandatory before production activation.

## Rollback

Disable the `chrome-devtools` MCP server entry in the client/gateway configuration and stop the browser worker. No database migration or production environment variable is required by this local integration. Keep the policy mapping and audit records for incident review.
