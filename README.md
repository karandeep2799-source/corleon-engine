# Corleon Engine

Standalone production foundation for AI orchestration, integrations, data, and agent workloads.

## Stack

- Next.js App Router + React
- TypeScript
- pnpm workspaces
- Turborepo
- Prisma/PostgreSQL integration point
- Vercel deployment
- Shared `@corleon/ui` package

## Local development

```bash
pnpm install
pnpm dev
```

Run only the deployable web application:

```bash
pnpm build:web
```

The production build is cached by Turborepo. The Next.js app is configured with `output: 'standalone'` so the web application can run independently of the rest of the repository.

## Vercel

The repository is configured as a monorepo with the deployable application at `apps/web`.

- Install: `pnpm install`
- Build: `pnpm turbo build --filter=@corleon/web`
- Output: `apps/web/.next`
- Framework: Next.js

Vercel can build only the web application while Turborepo tracks workspace dependencies and reuses cached outputs between deployments.

## Health

After deployment, `/api/health` returns a machine-readable service health response.

## Workspace layout

```text
apps/web       Deployable Next.js application
apps/api       Optional standalone Fastify API service
packages/ui    Shared React UI primitives
prisma/        Database layer and migrations
codex/         Codex skills and development tooling
docs/          Architecture and product documentation
```

The web app is the standalone production surface. The API workspace remains available for workloads that need a dedicated long-running service.
