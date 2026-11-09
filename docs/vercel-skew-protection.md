# Vercel Skew Protection — Corleon Engine

## Status

- Vercel project: `corleon-engine`
- Repository: `karandeep2799-source/corleon-engine`
- Framework: Next.js 16 App Router
- Runtime: Node.js 24.x
- Vercel team plan observed during setup: Hobby
- Automatically expose system environment variables: enabled through the Vercel project API; verify in Project Settings before the next production release.
- Native Vercel Skew Protection: **blocked by the current Hobby plan**. Vercel documents this feature for Pro and Enterprise.

No production deployment was triggered as part of this setup.

## Why this configuration is intentionally minimal

Next.js 14.1.4 and newer has native support for Vercel Skew Protection. Corleon Engine uses Next.js 16, so it does not need a custom `deploymentId` in `next.config.ts` when built and deployed by Vercel.

Do not add a generated timestamp, Git SHA, or hand-authored deployment ID to the Next.js config for the normal Vercel Git deployment flow. Custom deployment IDs are intended for special prebuilt workflows where the build happens outside Vercel and the ID must be carried into deployment.

The repository search found server-side fetches to external Binance endpoints; those requests do not need Vercel deployment pinning. If a future client component makes a direct same-origin `fetch()` to a Corleon API route, explicitly assess deployment pinning for that request. Vercel does not automatically pin arbitrary custom client-side fetch calls.

## Enable native Skew Protection after plan eligibility

1. Move the Vercel team to Pro or Enterprise only after reviewing and approving the subscription cost.
2. Open the `corleon-engine` project in Vercel.
3. Go to **Settings → Advanced → Skew Protection**.
4. Confirm **Automatically expose system environment variables** is enabled.
5. Enable **Skew Protection**.
6. Set the maximum age no higher than the deployment-retention period. Prefer the longest period that the project can safely retain old deployments; do not assume a fixed 12-hour default.
7. Redeploy the latest production commit through the normal reviewed GitHub/Vercel release process.
8. Verify the production deployment exposes `VERCEL_SKEW_PROTECTION_ENABLED=1` and `VERCEL_DEPLOYMENT_ID` in its deployment environment.

The current Hobby plan does not include native Skew Protection. Setting system environment exposure does not bypass that plan restriction.

## Release verification checklist

- [ ] Vercel team plan is Pro or Enterprise.
- [ ] Automatic system environment variable exposure is enabled.
- [ ] Skew Protection is enabled in project Advanced settings.
- [ ] Maximum age does not exceed deployment retention.
- [ ] A new production deployment completed successfully.
- [ ] The deployment environment reports `VERCEL_SKEW_PROTECTION_ENABLED=1`.
- [ ] A browser session opened before a new deployment can complete framework-managed client navigation and Server Actions without version-skew errors.
- [ ] Monitoring shows requests with `skew_protection = 'active'` when an older deployment is serving pinned framework requests.

## Long-lived sessions

Do not set a global `__vdpl` cookie by default. It pins document navigations to an older deployment and can prevent users from receiving a security or bug-fix release until the pin is cleared. Consider route-scoped pinning only for a concrete workflow that cannot tolerate a reload (for example, a live assessment or an in-progress multi-step transaction), and pair it with an explicit session-completion path that clears the cookie.

## Scope and safety

- This setup does not change application business logic, database schema, payment flows, or secrets.
- No deployment was created, promoted, or aliased.
- No plan upgrade or paid add-on was purchased.
- Keep the normal CI, preview validation, and approved production release process.
