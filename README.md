# Corleon Engine

Corleon Engine is a Next.js 16 and React 19 application with Prisma/PostgreSQL, payment integrations, and an existing OpenAI Agents SDK foundation. The eve Sanity Copilot adds a governed content-specialist runtime without replacing those systems.

## Core stack

- Next.js 16 App Router and React 19
- TypeScript
- Prisma 6 and PostgreSQL
- OpenAI Agents SDK
- eve agent runtime
- Vercel Connect for user-scoped provider credentials
- Vercel deployment

## Development

Install dependencies and start the application:

    npm install
    npm run dev

Run the eve agent in its local terminal UI:

    npm run eve:dev

Inspect the compiled agent:

    npm run eve:info

Run the agent typecheck and the full application checks:

    npm run typecheck:agent
    npm run typecheck
    npm test
    npm run build

The production build runs Prisma generation, the eve agent build, and the Next.js build. The existing Prisma models and payment integrations remain in place.

## eve content copilot

The agent is defined in the root agent directory and mounted by next.config.ts through eve/next. It shares the existing Next.js deployment and same origin under /eve/v1/*.

Channels and capabilities:

- Slack channel using Vercel Connect credentials
- Sanity MCP connection for schema inspection, GROQ queries, and content review
- Notion MCP connection for search, reading, and draft preparation
- Skills for Sanity, content modeling, writing quality, and SEO/AEO
- Human approval required for all mutations and unknown tool operations

The HTTP agent channel is restricted to Vercel OIDC calls from the Corleon Engine project and trusted local development. Browser access is intentionally disabled until the application's user authentication is connected to an eve AuthFn. Do not expose private CMS data through an unauthenticated browser route.

See docs/architecture/eve-sanity-copilot.md for connector setup, permissions, and the production validation checklist.

## Production safety

- Payment checkout remains governed by the existing payment feature flags.
- No database migration is introduced by the eve integration.
- No Sanity or Notion provider secrets are committed.
- No production connector is created or authorized by this change.
- Publishing, deletion, schema deployment, dataset changes, release operations, and Notion writes require an explicit approval through the agent framework.
