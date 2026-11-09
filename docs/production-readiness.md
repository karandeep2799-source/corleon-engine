# Corleon Engine — Production Readiness

**Audit date:** 2026-11-10  
**Repository:** `karandeep2799-source/corleon-engine`  
**Vercel project:** `corleon-engine`  
**Production URL:** https://corleon-engine.vercel.app/

## Verified baseline

- GitHub repository is accessible and writable; default branch is `main`.
- Vercel project is linked to the GitHub repository and uses Next.js.
- The latest observed production deployment is `READY`, from `main` commit `f107d53aa1bdd8731ecd8dbbb05c3e2d982a148f`.
- The public homepage and `/api/health` respond.
- The production domain `corleon-engine.vercel.app` is verified.
- Vercel reports the team plan as Hobby.
- The visible Vercel environment inventory contained `ENABLE_EXPERIMENTAL_COREPACK`; no `DATABASE_URL`, TinyFish, OpenAI, Stripe, Razorpay, Google Play service-account, or other provider credentials were listed. Secret values were not requested or read.

## Health semantics

- `GET /api/health` is a liveness endpoint. It confirms that the web process can answer a request; it does not prove that PostgreSQL or external providers are available.
- `GET /api/ready` is a readiness endpoint. It returns HTTP 200 only after a successful PostgreSQL `SELECT 1`. It returns HTTP 503 with a non-sensitive check status when `DATABASE_URL` is missing or the database cannot be reached.
- Readiness responses are explicitly non-cacheable. Database connection details are never returned to callers.

## Vercel deployment configuration

The existing Vercel project is linked to the monorepo and deploys the `apps/web` workspace using the root pnpm/Turborepo build. Keep the existing project root, install command, and build command unless a separate verified change requires otherwise.

The current team is on Hobby. Vercel documents native Skew Protection as a Pro/Enterprise feature. Next.js 16 already supports the framework-managed deployment pinning protocol; do not add a fabricated `deploymentId` or a global `__vdpl` cookie. Do not upgrade the Vercel plan without explicit cost approval.

## Existing integration work — not yet production-connected

The repository has multiple open, mostly draft pull requests for distinct capabilities, including TinyFish, Google Play Developer APIs, payment flows, Sandbox execution, image generation, TaskOS, knowledge ingestion, and market/data workspaces. They are not all part of the production `main` branch. Do not merge them as one batch: several have merge conflicts or explicitly documented authentication, schema, provider-credential, and validation blockers.

Before each integration is enabled:

1. Review the PR diff and security boundary.
2. Resolve merge conflicts on an isolated branch.
3. Run CI, type checks, tests, Prisma validation, and a production build.
4. Add only the required secrets to the Preview environment first.
5. Verify authenticated preview smoke tests and tenant isolation.
6. Apply additive database migrations only after backup/restore and rollback review.
7. Obtain explicit approval before production environment changes, payments, publishing, trading, or deployment promotion.

## Observability status

- GitHub Actions currently runs lint, typecheck, tests, and the web build.
- Add Prisma schema validation to CI using a dummy connection URL; this validates schema syntax without connecting to a database.
- Vercel Speed Insights is not yet installed in the active `main` app. Its package and root-layout integration must be added together with a committed lockfile update, then enabled and verified in the Vercel project dashboard.
- No external observability drain should be configured until a destination, retention policy, and data-handling approval exist.

## Required owner-provided setup

Configure these only in the relevant provider's secret manager or Vercel environment-variable UI; never paste secret values into chat or commit them:

- PostgreSQL: `DATABASE_URL`
- AI providers: the provider-specific API keys required by the selected model adapters
- TinyFish: `TINYFISH_API_KEY` and the separate Corleon route access token, if using the PR #29 implementation
- Payment providers: test credentials and webhook secrets only after the real Corleon authentication and quote/order flow is verified
- Google Play: Android package name, developer account access, service-account permission, and Pub/Sub configuration
- Any optional storage, queue, or worker service: credentials and endpoint values for the selected deployment architecture

## Release gates

- [ ] CI passes on the exact candidate commit.
- [ ] `/api/health` returns HTTP 200.
- [ ] `/api/ready` returns HTTP 200 only when PostgreSQL is reachable.
- [ ] Prisma migrations are reviewed and applied to a non-production database first.
- [ ] Preview smoke tests pass with least-privilege test credentials.
- [ ] Authentication, organization scoping, rate limits, and audit logging are verified.
- [ ] Payment, publishing, and live-trading controls remain disabled until separately approved.
- [ ] Production deployment and promotion are explicitly approved.
