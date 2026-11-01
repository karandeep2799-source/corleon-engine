# Corleon Engine

Corleon Engine is a model-independent AI platform and integration backend. The Next.js application is deployed from `apps/web`; existing backend modules, Prisma data models, payment/webhook handlers, and agent services remain at the repository root.

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
pnpm install
pnpm dev
```

Useful checks:

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Vercel

The Vercel project root stays at the repository root so existing root-level API functions and cron handlers remain part of the deployment.

- Framework: Next.js
- Node.js: 24.x
- Install: `pnpm install --frozen-lockfile`
- Build: `pnpm turbo run build --filter=@corleon/web`
- Output: `apps/web/.next`
- Package manager: `pnpm@12.4.0`, selected through Corepack

The Vercel project uses `ENABLE_EXPERIMENTAL_COREPACK=1` so the package-manager version in the root `package.json` is honored. The generated `pnpm-lock.yaml` is committed and CI/Vercel use frozen installs.

## Health check

After deployment, `/api/health` returns a machine-readable health response.

## Workspace layout

```text
apps/web       Deployable Next.js application
packages/ui    Shared React UI primitives
api/           Existing Vercel API and webhook functions
src/           Existing AI, cash-flow, and MCP modules
prisma/        Existing Prisma schema
docs/          Architecture and operating documentation
```

## Release safety

- Keep production financial execution disabled; Binance integration is market-data and paper-trading only.
- Do not apply Prisma migrations as part of a web deployment.
- Configure secrets only in Vercel's environment-variable manager; never commit populated environment files.
- Merge and promote only after CI, preview route checks, and application smoke tests pass.
