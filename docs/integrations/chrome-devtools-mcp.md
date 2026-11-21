# Chrome DevTools MCP integration

**Status:** Gateway core + hardened per-task worker packaging; production activation gated  
**Upstream:** https://github.com/ChromeDevTools/chrome-devtools-mcp  
**Upstream package:** `chrome-devtools-mcp@1.12.0`  
**Reviewed:** 2026-11-10

## Purpose

Chrome DevTools MCP gives Corleon agents browser diagnostics and automation through the official Chrome DevTools Model Context Protocol server. Chromium does not run inside Next.js or a Vercel Function. Corleon consumes the worker over MCP stdio through a trusted gateway.

## Architecture

1. The hosting adapter authenticates a user or service and derives tenant, actor and session identity server-side.
2. A worker provisioner creates one isolated browser worker for that task/session. It must not reuse browser profiles or cookies across tenants.
3. `src/mcp/chrome-devtools-gateway.js` exposes a policy-enforcing gateway around that worker. It filters tool discovery and authorizes every `tools/call`.
4. The gateway binds approvals to the trusted identity, exact upstream tool name and SHA-256 digest of canonicalized arguments. The approval adapter must atomically validate and consume a one-time token.
5. An append-only audit adapter records redacted lifecycle events. If audit persistence fails, browser actions fail closed.
6. The host proxies MCP messages over the worker's stdio and destroys the worker on completion, cancellation, disconnect, timeout or revocation.

The gateway accepts trusted identity and adapter functions from its host; it does not trust tenant IDs from MCP messages and does not implement authentication by itself. Do not expose the worker, Docker socket, raw CDP endpoint or stdio to browsers or untrusted agents.

## Repository components

- `config/mcp/chrome-devtools-server.json`: conservative local developer profile.
- `config/mcp/chrome-devtools-worker.json`: container profile with the egress proxy.
- `src/mcp/chrome-devtools.js`: pinned server definition and upstream-tool to Corleon-policy mapping.
- `src/mcp/chrome-devtools-gateway.js`: MCP gateway, tool filtering, per-call policy enforcement, action-bound approval checks, message limits and fail-closed audit hooks.
- `src/mcp/policy.js`: default-deny/approval policy.
- `services/browser-worker/`: non-root, read-only worker image.
- `services/egress-proxy/`: outbound proxy with private/link-local destination ACLs.
- `docker-compose.browser-worker.yml`: local/staging network topology reference.
- `apps/web/lib/mcp/`: policy, gateway and worker regression tests.

## Capabilities and defaults

The worker profile enables navigation, performance, network and debugging categories, with browser input disabled. It supports page discovery, snapshots, screenshots, console/network inspection and performance diagnostics.

Both profiles disable click/fill/keyboard/drag input, arbitrary JavaScript evaluation, experimental DevTools target access, coordinate-based vision, third-party page tools, WebMCP execution, extensions, PWA mutations, WebAuthn and heap-snapshot inspection. Network headers are redacted; insecure TLS certificates are not accepted.

The container profile starts Chromium headlessly with a temporary profile, requires page IDs for page-scoped calls, disables `file:` navigation, and routes Chrome traffic through `egress-proxy:3128`. Browser-side deny patterns cover loopback and cloud metadata hostnames across schemes and non-default ports; the proxy independently denies local, private, link-local, reserved and translation-prefix destinations.

## Gateway adapter contract

A trusted host creates a gateway for each authenticated task:

- `identity`: server-derived `tenantId`, `actorId` and `sessionId`; all are required.
- `worker`: isolated worker adapter implementing `request(message)` and `close()`.
- `audit(event)`: durable append-only audit sink. It must not store page bodies, screenshots, cookies, authorization headers, tokens or raw tool arguments by default.
- `consumeApproval(input)`: atomic one-time approval verifier. It must validate tenant, actor, session, exact tool, action digest, expiry and nonce. It must reject replay and mismatched arguments.
- `authorize(toolName, { production })`: optional policy adapter. The default uses Corleon's shared tool policy.
- `production`: defaults to true. In production, otherwise-readable diagnostics require explicit approval; explicitly denied capabilities remain denied.

Approval metadata is passed as `params._meta["corleon/approval-token"]`. The gateway removes this metadata before forwarding the request to Chrome DevTools MCP. The token is never written to audit events. The action digest is SHA-256 over canonical JSON containing the exact tool name and arguments.

The gateway core is deliberately independent of a specific identity provider, database or container platform. Connect it only through server-side adapters; never implement approval validation as a client-side boolean or accept a tenant ID supplied in the MCP payload.

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

## Production release gates

The repository now contains the policy-enforcing gateway core, but production activation still requires platform-specific adapters and operational verification:

1. Integrate the gateway with Corleon's real authentication/session provider; derive tenant identity server-side.
2. Implement the worker provisioner using the selected container platform. Use one worker per task and never mount a Docker socket into an internet-facing app.
3. Implement atomic, single-use approval storage and durable append-only audit storage.
4. Enforce per-tenant concurrency, navigation, CPU, memory, wall-clock and output limits. Kill workers on timeout, disconnect, cancellation or revocation.
5. Apply VPC-level egress controls and monitor blocked connection attempts.
6. Complete cross-tenant isolation, SSRF/DNS-rebinding, prompt-injection, cancellation, resource-exhaustion and incident-response tests.
7. Pin deployment images by digest, scan them and maintain a Chromium patch/roll-forward process.

No browser worker, gateway endpoint, environment variable, database migration, Vercel setting or production deployment is enabled by this change.

## Validation

```bash
pnpm --filter @corleon/web lint
pnpm --filter @corleon/web typecheck
pnpm --filter @corleon/web test
pnpm --filter @corleon/web build
docker compose -f docker-compose.browser-worker.yml config
docker compose -f docker-compose.browser-worker.yml build
```

The CI validates the web workspace, Compose syntax and image builds. Regression tests cover policy deny semantics, config path traversal, browser URL restrictions, proxy ACL guardrails and gateway authorization. These tests do not prove runtime network isolation. Container runtime, live egress, real-Chrome, DNS-rebinding, cross-tenant and hosting-adapter tests must run in a Docker-enabled release pipeline before production activation.

## Rollback

Stop and remove the task worker container; revoke its gateway session; discard its temporary profile. Disable the `chrome-devtools` MCP server entry if rolling back local use. Preserve redacted audit receipts for incident review.
