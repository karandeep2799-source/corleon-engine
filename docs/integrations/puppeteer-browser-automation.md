# Puppeteer browser automation

## Decision

Corleon Engine uses a dedicated `@corleon/browser-automation` workspace as a typed, policy-gated adapter over Puppeteer. It is designed to be called by an authenticated browser worker or a future Chrome DevTools MCP tool adapter. It does not launch a browser or expose a network endpoint itself.

## Capabilities

| Operation | Puppeteer primitive | Guardrails |
|---|---|---|
| Press/release a key | `page.keyboard.press()` | Safe key allowlist; bounded delay |
| Enter text | `page.keyboard.type()` | Bounded length/delay; password and payment-card fields blocked; audit excludes text |
| Click | `page.mouse.click()` | Viewport bounds; optional approval |
| Move | `page.mouse.move()` | Viewport bounds; bounded interpolation steps |
| Scroll | `page.mouse.wheel()` | Bounded deltas |

## Runtime integration

1. Authenticate the actor and resolve tenant/session server-side.
2. Allocate an isolated browser context in a dedicated worker.
3. Apply destination policy at the network layer; the package's host check is an additional application guard, not a substitute for SSRF protection.
4. Create the controller with a minimal `allowedHosts` list and only the actions needed for the task.
5. Route consequential actions through a human approval callback.
6. Send content-free audit events to the durable audit sink.
7. Close the browser context on completion, timeout, cancellation or actor revocation.

## MCP tool design

Expose stable namespaced tools such as `browser.keyboard.press`, `browser.keyboard.type`, `browser.mouse.click`, `browser.mouse.move` and `browser.mouse.wheel`. Each tool should declare its read/write classification, required session scope, risk tier, timeout, approval policy and audit schema. Do not expose a generic arbitrary JavaScript or raw CDP execution tool through this adapter.

## Deployment boundary

Do not deploy Chromium into the Next.js/Vercel request path. Run browser sessions in a separately scaled, isolated worker. The Vercel project connection is verified, but no project settings, environment variables, deployments or production resources are changed by this integration.

## Validation

From repository root:

```bash
pnpm --filter @corleon/browser-automation typecheck
pnpm --filter @corleon/browser-automation test
pnpm --filter @corleon/browser-automation build
```

A worker-level integration test with real Chromium, network egress controls, tenant isolation and cancellation remains a prerequisite before enabling live MCP execution.
