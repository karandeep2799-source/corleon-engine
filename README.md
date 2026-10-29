# Corleon Engine

Standalone production foundation for AI orchestration, integrations, data, and agent workloads.

## Stack

- Next.js App Router + React
- TypeScript
- pnpm workspaces
- Turborepo
- Prisma/PostgreSQL integration point
- Vercel deployment
- Shared @corleon/ui package
- eve agent runtime for governed content workflows

## Local development

```bash
pnpm install
pnpm dev
```

Run only the deployable web application:

```bash
pnpm build:web
```

Run the eve content copilot in the local terminal UI:

```bash
pnpm dev:agent
```

Build the eve agent:

```bash
pnpm build:agent
```

The production build is cached by Turborepo. The Next.js app is configured with output: standalone so the web application can run independently of the rest of the repository.

## Vercel

The repository is configured as a monorepo with the deployable application at apps/web. The root vercel.ts composes the Next.js web service and the eve agent in the same Vercel project. The web app remains the primary application surface; the agent is served through the private, authenticated /eve/v1/* API and the configured Slack channel.

- Web service root: apps/web
- Web build: pnpm exec next build
- Agent source: agent/
- Agent build: eve build
- Existing release-commission cron is preserved in vercel.ts

The eve HTTP channel is restricted to Vercel OIDC requests from the Corleon project and trusted local development. Browser access is intentionally disabled until application authentication is integrated. Sanity and Notion mutations require framework-level human approval.

See docs/architecture/eve-sanity-copilot.md for connector setup, security controls, and production validation.

## Health

After deployment, /api/health returns a machine-readable service health response.

## Workspace layout

```text
apps/web       Deployable Next.js application
apps/api       Optional standalone Fastify API service
packages/ui    Shared React UI primitives
agent/         eve content copilot, skills, channels, and connections
docs/          Architecture and product documentation
codex/         Codex skills and development tooling
```

The web app is the standalone production surface. The API workspace remains available for workloads that need a dedicated long-running service. The eve agent is composed as a peer Vercel service and does not replace either application.
