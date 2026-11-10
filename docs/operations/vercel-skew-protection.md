# Vercel Skew Protection — Corleon Engine

## Status

- Vercel project: `corleon-engine`
- Framework: Next.js 16
- Deployment model observed: Vercel Git deployments
- Repository root: monorepo; deployable app is `apps/web`
- Production deployment observed: branch `main`, commit `f107d53aa1bdd8731ecd8dbbb05c3e2d982a148f`
- Latest preview observed during audit: branch `feat/stripe-customer-update`
- Code/config changes required for the current Git-deployment path: none identified.
- Dashboard setting verification: pending; the available project read response did not expose the Skew Protection toggle or automatic system-environment-variable setting.

This runbook does not enable settings, change environment variables, deploy, promote, or alter production traffic.

## Why this is the selected design

Vercel documents automatic Skew Protection for supported frameworks, including Next.js. Projects created after November 19, 2024 using a supported framework have Skew Protection enabled by default. The Corleon Engine Vercel project was created after that date and is configured as Next.js.

The repository uses Vercel Git deployments rather than a custom `vercel build` + `vercel deploy --prebuilt` release pipeline. Therefore, do not add a hand-managed `deploymentId` to `apps/web/next.config.ts` for the current deployment path. A custom ID is relevant when building outside Vercel and deploying prebuilt output; it must be unique per project and meet Vercel's format constraints.

## Required dashboard verification

In Vercel, open the `corleon-engine` project:

1. Open **Settings → Environment Variables** and verify **Automatically expose System Environment Variables** is enabled.
2. Open **Settings → Advanced → Skew Protection** and verify Skew Protection is enabled.
3. Confirm the configured maximum age is compatible with the team's deployment-retention policy. Do not increase it without an explicit retention and rollback review.
4. Redeploy only after the setting is confirmed and a deployment is explicitly approved.

The Vercel system variables to verify in a deployment (do not print their values into logs) are:

- `VERCEL_SKEW_PROTECTION_ENABLED` — expected value `1` when enabled.
- `VERCEL_DEPLOYMENT_ID` — expected to be present for the deployment.

Do not create user-managed copies of these Vercel system variables.

## Request coverage and application rules

Vercel/Next.js Skew Protection covers framework-managed requests such as static assets, client-side navigation, prefetches, and Server Actions when supported by the deployed Next.js version.

It does **not** automatically pin arbitrary browser `fetch()` calls to Route Handlers or external APIs. For custom calls that must be version-aware, assess the endpoint and its compatibility contract before adding a deployment ID header or query parameter. Never assume an arbitrary API request is pinned.

Top-level document navigations and hard refreshes normally receive the latest deployment. Do not install a global `__vdpl` cookie by default. Pinning document navigation is an opt-in strategy for genuinely long-lived, interruption-sensitive sessions (for example, an in-progress voice session or a checkout wizard). If later required, scope it narrowly to the relevant routes and define expiry, logout, deployment-retention, and forced-invalidation behavior.

## Corleon release safety

- Keep database changes backward-compatible across at least the active deployment overlap window.
- Use expand → deploy compatible code → backfill → contract for Prisma/PostgreSQL schema changes.
- Do not run destructive migrations as part of a deployment.
- Keep Stripe webhook handlers idempotent and tolerant of old/new application versions during rollout.
- Persist critical workflow progress server-side; do not rely solely on in-memory React state across a forced reload.
- Keep payment execution, commission release, and other financial side effects behind their existing approval and fail-closed controls.
- Retain prior deployments for at least the configured Skew Protection window, subject to Vercel plan and retention limits.

## Verification test plan

Run against a Preview deployment first; do not use production traffic for the initial test.

1. Open the preview deployment and keep the tab open.
2. Deploy a second preview from a later commit.
3. From the older tab, exercise client-side navigation, prefetch, static assets, and Server Actions.
4. Confirm framework-managed requests continue to resolve consistently with the original deployment while the old deployment remains retained and within the skew window.
5. Hard-refresh the old tab and confirm it transitions to the latest deployment as expected.
6. Exercise custom client-side `fetch()` calls separately; document that these are not automatically pinned.
7. Check Vercel Monitoring / Requests and filter `skew_protection = 'active'` to confirm protected traffic is being served.
8. Repeat with a preview-only long-running workflow if a route-scoped document pin is ever introduced.

## Operational recovery

- For a bad release, use the normal reviewed Vercel rollback procedure; Skew Protection is not a substitute for rollback.
- If a fixed deployment must stop older deployments from receiving requests, evaluate Vercel's Skew Protection Threshold for that deployment. Treat this as an incident action because it can invalidate older active clients.
- Never delete old deployments manually while users may still rely on their protected version.
- Record the deployment ID, commit SHA, incident window, and affected workflow when investigating version-skew errors.

## Audit references

- Vercel Skew Protection: https://vercel.com/docs/skew-protection
- Vercel System Environment Variables: https://vercel.com/docs/environment-variables/system-environment-variables
- Next.js deploymentId: https://nextjs.org/docs/app/api-reference/config/next-config-js/deploymentId
