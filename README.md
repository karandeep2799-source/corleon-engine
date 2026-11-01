# Corleon Engine

Corleon Engine is a model-independent AI platform and integration backend. The deployable Next.js application lives in `apps/web`; the existing backend modules, Prisma data models, payment/webhook implementations, cash-flow services, and agent integrations remain at the repository root.

## Production stack

- Node.js 24
- pnpm 12 workspaces and Turborepo
- Next.js 16 App Router + React 19 + TypeScript
- Prisma + PostgreSQL
- Vercel deployment
- Existing AI, cash-flow, payment, MCP, and learning modules

## Local development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Useful checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Vercel

The Vercel project root is `apps/web`. The project setting **Include source files outside the Root Directory** is enabled so the app can consume workspace packages and the existing backend implementations.

- Framework: Next.js
- Node.js: 24.x
- Package manager: `pnpm@12.4.0` (Corepack enabled)
- Install command: `cd ../.. && pnpm install --frozen-lockfile`
- Build command: `cd ../.. && pnpm turbo run build --filter=@corleon/web`
- Next.js output: `.next` (framework default)
- Deployment config: `apps/web/vercel.json`

The cron and Stripe webhook entrypoints are in `apps/web/api/` and re-export the existing implementations from the root `api/` directory. Their public paths remain `/api/cron/release-commissions` and `/api/webhooks/stripe`.

The Vercel project uses `ENABLE_EXPERIMENTAL_COREPACK=1` so the pinned package-manager version is honored.

## Health check

After deployment, `/api/health` returns a machine-readable health response.

## Workspace layout

```text
apps/web       Deployable Next.js application and Vercel function entrypoints
packages/ui    Shared React UI primitives
api/           Existing API and webhook implementations
src/           Existing AI, cash-flow, and MCP modules
prisma/        Existing Prisma schema
docs/          Architecture and operating documentation
```

## Release safety

- Keep production financial execution disabled; Binance integration is market-data and paper-trading only.
- Do not apply Prisma migrations as part of a web deployment.
- Commission-release cron fails closed unless `CRON_SECRET` is configured in Vercel; do not configure it until commission release is explicitly approved.
- Configure secrets only in Vercel's environment-variable manager; never commit populated environment files.
- Merge and promote only after CI, preview route checks, and application smoke tests pass.
