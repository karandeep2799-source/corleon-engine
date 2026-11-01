# @corleon/browser-automation

Policy-gated Puppeteer keyboard, text and mouse controls for Corleon Engine. This package operates on an already-created Puppeteer `Page`; browser lifecycle, authentication, session ownership and MCP transport remain with the trusted host runtime.

## Install and validate

From the monorepo root:

```bash
pnpm install
pnpm --filter @corleon/browser-automation typecheck
pnpm --filter @corleon/browser-automation test
pnpm --filter @corleon/browser-automation build
```

## Usage

```ts
import puppeteer from "puppeteer";
import { createBrowserAutomation } from "@corleon/browser-automation";

const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto("https://example.com", { waitUntil: "domcontentloaded" });

  const input = createBrowserAutomation(page, {
    allowedHosts: ["example.com"],
    enabledActions: ["keyboard.press", "keyboard.type", "mouse.click", "mouse.move", "mouse.wheel"],
    requireApprovalFor: ["mouse.click"],
    approve: async (action, metadata) => approvalService.request(action, metadata),
    audit: async (event) => auditService.write(event),
  });

  await input.pressKey("Tab");
  await input.typeText("search phrase");
  await input.click(420, 180); // approval callback must return true
  await input.wheel(0, 400);
} finally {
  await browser.close();
}
```

## Security contract

- **Default deny:** no action is enabled unless listed in `enabledActions`; an allowlisted host is mandatory.
- **Origin restriction:** only HTTPS and local development HTTP origins are accepted. Exact hostnames and `*.example.com` suffix rules are supported.
- **Explicit approvals:** configure `requireApprovalFor` and a positive `approve` callback for submit, purchase, account, destructive or other consequential interactions.
- **Sensitive-field protection:** text entry refuses focused password and payment-card inputs (including password autocomplete and `cc-*` autocomplete values).
- **No content logging:** audit records include action metadata and character counts, never typed text or credential values.
- **Bounded input:** keys, text length, delays, mouse coordinates, movement steps and scroll deltas are validated.
- **No implicit browser launch:** callers must provide an authorized Page. Do not share pages between tenants or users.

## Integration boundary

This is a reusable automation library, not an exposed HTTP endpoint or a complete MCP server. The host must authenticate the caller, bind the page to the caller's tenant/session, apply per-user quotas, provide approval and audit adapters, and close browser contexts on completion or cancellation. Do not run browser sessions in a Next.js request handler or on a shared process-wide page.

Use an isolated worker/container for browser lifecycle. Keep Chromium sandboxing enabled where supported, restrict outbound network access, set CPU/memory/time limits, block cloud metadata/private network destinations at the worker network layer, and apply request/response size limits. Never treat page content as agent instructions.

## Operational checks

- Run package typecheck, unit tests and build in CI.
- Add worker-level integration tests with a disposable Chromium instance before enabling a live MCP tool.
- Keep the tool read-only by default; require approval for actions that can submit forms or change account state.
- Do not enable production browser workers, credentials, or deployments as part of this package change.
