# Vercel System Environment Variables

Corleon Engine reads a small allowlist of Vercel system variables to attach
deployment context to server-side diagnostics and operational tooling.

## Implementation

Use the server-only helper at:

`apps/web/src/lib/platform/deployment.ts`

Example:

```ts
import { getDeploymentMetadata } from "@/lib/platform/deployment";

const metadata = getDeploymentMetadata();
```

The helper returns normalized deployment metadata:

- provider and deployment environment
- deployment ID and HTTPS deployment URL
- project production URL
- runtime region
- Git branch, commit SHA and pull-request ID
- skew-protection enabled state, when supplied

It deliberately does not return arbitrary environment values, database credentials,
API keys, or `VERCEL_OIDC_TOKEN`.

## Vercel project configuration

In Project Settings, enable **Automatically expose System Environment Variables**
for the Corleon Engine project. Vercel system variables are supplied by the platform;
do not create manual copies of them.

Keep application secrets in the appropriate Production, Preview and Development
scopes. Never prefix server secrets or OIDC tokens with `NEXT_PUBLIC_`.

## Runtime and build considerations

- Treat `VERCEL_ENV` as the environment discriminator: production, preview or
  development. Local execution falls back to development.
- `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL` are hostnames; the helper
  normalizes them to HTTPS origins.
- Some system variables are available only at build time or runtime. Do not assume
  every variable exists in every execution context.
- When using `vercel deploy --prebuilt`, Vercel system environment variables are
  not available during the prebuilt build step. Do not use this helper to make
  build output depend on those values.
- `VERCEL_OIDC_TOKEN` is a credential for supported workload identity flows.
  Retrieve/use it only in the server-side integration that needs it; never log,
  serialize, or send it to a browser.

## Operational guardrails

1. Preview deployments must not run production-only payment, publishing, or
   destructive data operations.
2. Use explicit server-side authorization and environment checks for privileged
   operations; metadata is not an authorization mechanism.
3. Include deployment ID and commit SHA in structured logs where useful, but
   avoid logging customer data or secrets.
4. Do not assume a region is fixed; Vercel may execute functions in configured
   regions.
5. Verify system-variable availability in the target Vercel project before
   relying on any optional field.

## Validation

The Vitest suite covers local defaults, preview metadata normalization, malformed
URL handling, unknown environment values, and secret non-disclosure.

Run from the repository root:

```bash
pnpm --filter @corleon/web test
pnpm --filter @corleon/web typecheck
pnpm --filter @corleon/web build
```

This change does not alter Vercel project settings, environment-variable values,
deployment targets, domains, or production traffic.
