# Corleon Chrome DevTools browser worker

This image packages the official, pinned Chrome DevTools MCP server in a non-root,
read-only container. It is a **per-task worker**, not a shared browser daemon.

## Security contract

- One container and temporary Chromium profile per task; never share cookies or profiles across tenants.
- MCP uses stdio only. Do not publish a TCP port or expose Chrome's remote-debugging endpoint.
- The browser container joins only the internal `browser-private` network. Its only route to the public internet is the Squid proxy.
- The proxy denies loopback, RFC1918, link-local, CGNAT, benchmark, multicast, reserved and IPv6 local destinations after DNS resolution.
- The worker has no Linux capabilities, runs as the unprivileged `node` user, has a read-only root filesystem, bounded memory/CPU/processes, and temporary writable mounts.
- The MCP configuration is baked into the image as root-owned read-only content. Agent-provided config paths are not accepted.
- Input, arbitrary JavaScript, DevTools target control, extensions, WebMCP, PWA and WebAuthn tools are disabled. Network headers are redacted.

The Squid ACL is a second line of defense, not a replacement for cloud VPC egress policy.
In production, enforce equivalent or stricter egress rules at the VPC/firewall layer,
including IPv4 and IPv6, DNS rebinding, redirects, CONNECT tunnels and metadata endpoints.

## Build

From the repository root:

```bash
docker compose -f docker-compose.browser-worker.yml build
```

The worker speaks MCP over container stdin/stdout. Use it only under a trusted
Corleon gateway that owns the process stdin/stdout pipes. The compose file is a
local/staging topology reference; it does not implement tenant authentication,
session orchestration, approvals, durable audit storage or a public MCP endpoint.

## Production orchestrator requirements

Before connecting this worker to customers, the gateway/orchestrator must:

1. Authenticate the user/service identity and derive tenant identity server-side.
2. Allocate a fresh worker per tenant/task and never accept a tenant ID supplied only
   in an untrusted request body.
3. Proxy MCP messages over stdio; do not expose raw Chrome DevTools Protocol or
   the worker's stdio to browsers.
4. Apply the Corleon policy to every tool call, not just tool discovery. Unknown
   upstream tools must be denied.
5. Bind approvals to tenant, actor, session, exact tool name, canonical target/action
   digest, expiry and one-time nonce. Reject replay and stale approvals.
6. Persist append-only audit receipts with redaction; never persist cookies,
   authorization headers, page bodies or screenshots unless separately authorized.
7. Enforce per-tenant concurrency, request/response size, navigation, CPU, memory,
   wall-clock and output limits. Support cancellation and kill the container on
   timeout, disconnect or revocation.
8. Restrict outbound destinations with a managed egress firewall/proxy and monitor
   denied connection attempts.
9. Scan the image, pin the deployed image by digest, patch Chromium promptly and
   run the worker with a supported container runtime/seccomp profile.
10. Complete cross-tenant isolation, SSRF, DNS-rebinding, prompt-injection,
    cancellation, resource-exhaustion and incident-response tests.

Do not mark the service production-enabled until these controls are implemented
and verified in the actual hosting environment.
