# Chrome DevTools MCP integration

**Status:** Local integration + hardened per-task worker packaging; production activation gated  
**Upstream:** https://github.com/ChromeDevTools/chrome-devtools-mcp  
**Upstream package:** `chrome-devtools-mcp@1.12.0`  
**Reviewed:** 2026-11-10

## Purpose

Chrome DevTools MCP gives Corleon agents browser diagnostics and automation through the official Chrome DevTools Model Context Protocol server. Corleon consumes it as an external stdio MCP server; Chromium does not run inside Next.js or a Vercel Function.

The implementation is split into:

- `config/mcp/chrome-devtools-server.json`: conservative local developer profile.
- `config/mcp/chrome-devtools-worker.json`: container profile with the egress proxy.
- `src/mcp/chrome-devtools.js`: pinned server definition and upstream-tool to Corleon-policy mapping.
- `src/mcp/policy.js`: default-deny/approval policy.
- `services/browser-worker/`: non-root, read-only worker image.
- `services/egress-proxy/`: outbound proxy with private/link-local destination ACLs.
- `docker-compose.browser-worker.yml`: local/staging network topology reference.
- `apps/web/lib/mcp/chrome-devtools-policy.test.ts`: policy regression tests.

## Capabilities and defaults

The local profile enables navigation, performance, network and debugging categories, with browser input disabled. It supports page discovery, snapshots, screenshots, console/network inspection and performance diagnostics.

Both profiles disable click/fill/keyboard/drag input, arbitrary JavaScript evaluation, experimental DevTools target access, coordinate-based vision, third-party page tools, WebMCP execution, extensions, PWA mutations, WebAuthn and heap-snapshot inspection. Network headers are redacted; insecure TLS certificates are not accepted.

The container profile starts Chromium headlessly with a temporary profile, requires page IDs for page-scoped calls, disables `file:` navigation, and routes Chrome traffic through `egress-proxy:3128`. Browser-side deny patterns cover loopback and cloud metadata hostnames across schemes and non-default ports; the proxy independently denies local, private, link-local, reserved, and translation-prefix destinations.

## Local setup

Requirements: Node.js 24, npm/npx, Docker Engine and the Docker Compose plugin.

For a trusted developer workstation:

```bash
npx --yes chrome-devtools-mcp@1.12.0 --config=config/mcp/chrome-devtools-server.json --no-javascript-evaluation --no-usage-statistics --no-update-checks --no-performance-crux
```

The MCP client launches this command over stdio. Do not expose the process over an unauthenticated HTTP endpoint.

## Worker image and isolated network

Build the worker and proxy images:

```bash
docker compose -f docker-compose.browser-worker.yml build
```

The worker container joins only the internal `browser-private` network. The proxy is the only service attached to both that network and the external egress bridge. Squid denies loopback, RFC1918, link-local, carrier-grade NAT, benchmark, multicast, reserved and IPv6 local destinations. The worker has no published ports, no Linux capabilities, a read-only root filesystem, non-root execution, bounded CPU/memory/PIDs and ephemeral writable mounts.

The compose file is a local/staging reference, not a production orchestrator. Run one worker container per tenant/task, bind its stdio only to the authenticated Corleon gateway, and destroy the container/profile on completion, timeout, disconnect or cancellation.

**Important:** Squid and Chrome URL patterns are defense-in-depth, not a complete SSRF boundary. Production must enforce equivalent or stricter cloud VPC/firewall egress rules after DNS resolution, including IPv4/IPv6, redirects, DNS rebinding, CONNECT tunnels, metadata endpoints and internal DNS zones. Pin production images by digest, scan them, and patch Chromium promptly.

## Corleon policy mapping

| Tool class | Corleon policy | Default |
|---|---|---|
| Page list, snapshots, screenshots | `browser.*.read` | Allow in non-production |
| Console, styles, network, performance diagnostics | `browser.*.read` | Allow in non-production |
| Navigation and page lifecycle | `browser.navigation.navigate` | Approval required |
| Click, fill, keyboard and drag | `browser.input.interact` | Approval required |
| Heap snapshots | `browser.memory.inspect` | Approval required |
| File upload | `browser.file.upload` | Deny |
| Arbitrary JavaScript | `browser.script.evaluate` | Deny |
| Extensions, third-party tools and WebMCP execution | `browser.*` | Deny |
| Unknown upstream tool | `browser.unknown` | Deny |

Explicit `deny` decisions remain denied in production; production mode only turns otherwise-allowed diagnostics into approval-required actions. Unknown tool names and JavaScript object prototype keys are denied. The local config-path helper rejects absolute paths, traversal segments, and malformed paths. These are policy-library safeguards, not proof that every call path is wired through a gateway. The policy mapping is not a security boundary if an agent can connect directly to the upstream server. Production calls must pass through a Corleon-controlled gateway that authenticates the actor, derives tenant/session ownership server-side, authorizes every tool invocation, validates approval, and records an audit receipt. Unknown upstream tools must remain denied.

## Production release gates

Before enabling customers:

1. Deploy the gateway/orchestrator separately from Vercel. It must create one isolated worker per task and proxy MCP messages over stdio.
2. Authenticate users/services and derive tenant identity server-side; never trust a request-body tenant ID.
3. Bind approvals to tenant, actor, session, exact tool, canonical target/action digest, expiry and one-time nonce. Reject replay and stale approvals.
4. Persist append-only audit receipts with redaction. Never log cookies, authorization headers, page bodies, tokens or screenshots by default.
5. Enforce per-tenant concurrency, request/response size, navigation, CPU, memory, wall-clock and output limits. Kill workers on timeout, disconnect, cancellation or revocation.
6. Apply VPC-level egress controls and monitor blocked connection attempts.
7. Keep Chromium sandboxing enabled; never add `--no-sandbox`. Keep worker config root-owned and read-only.
8. Complete real-Chrome smoke, cross-tenant isolation, SSRF/DNS-rebinding, prompt-injection, cancellation, resource-exhaustion and incident-response tests.
9. Pin deployment images by digest and maintain a Chromium patch/roll-forward process.

No browser worker, gateway endpoint, environment variable, database migration, Vercel setting or production deployment is enabled by this PR.

## Validation

```bash
pnpm --filter @corleon/web lint
pnpm --filter @corleon/web typecheck
pnpm --filter @corleon/web test
pnpm --filter @corleon/web build
docker compose -f docker-compose.browser-worker.yml config
docker compose -f docker-compose.browser-worker.yml build
```

The existing CI validates the web workspace, Compose syntax, and image builds. Regression tests cover policy deny semantics, config path traversal, browser URL restrictions, and proxy ACL guardrails. These tests do not prove runtime network isolation. Container runtime, live egress, real-Chrome, DNS-rebinding, cross-tenant and gateway orchestration tests must run in a Docker-enabled release pipeline before production activation.

## Rollback

Stop and remove the task worker container; revoke its gateway session; discard its temporary profile. Disable the `chrome-devtools` MCP server entry if rolling back local use. Preserve redacted audit receipts for incident review.
