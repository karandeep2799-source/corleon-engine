# Corleon Engine

Production-oriented AI orchestration foundation.

## Architecture

- `apps/web` — Next.js application
- `apps/api` — Fastify Node/TypeScript API
- `packages/*` — shared domain, security, AI, integrations, and database modules
- PostgreSQL/Prisma — planned persistence layer
- GitHub Actions — planned CI/security/deployment automation

## Development

Requires Node.js 22+ and pnpm 10+.

```bash
pnpm install
pnpm dev
```

Web: `http://localhost:3000`
API health: `http://localhost:4000/health`

## Security

Never commit `.env` files, API keys, OAuth client secrets, database credentials, or signing keys. Use environment variables locally and a managed secret store in production.
