# eve agent integration

## Decision

Corleon Engine keeps its existing Next.js web app, Fastify API, Prisma/PostgreSQL data layer, and OpenAI Agents SDK. The Vercel eve Sanity Copilot is integrated as an isolated workspace application at `apps/agent`, not as a replacement runtime or a second copy of the web application.

The workspace is covered by the existing `apps/*` pnpm workspace glob. The Vercel web project continues to build only `@corleon/web`; the agent is not included in the current production deployment.

## Included

- eve agent entry point and independent package manifest.
- Local eve development channel with Vercel OIDC and a local-only development fallback.
- User-scoped Vercel Connect connections for Sanity and Notion.
- Read-only tool allowlists. Unknown and mutating tools require explicit human approval.
- Agent instructions requiring read-before-write, draft-first workflows, and exact-target approval.
- No static connector credentials and no production deployment or connector provisioning.

## Local setup

Requirements: Node.js 24 and pnpm 10.15.0.

1. Install the monorepo dependencies from the repository root: `pnpm install`.
2. Start the agent locally: `pnpm --filter @corleon/agent dev`.
3. Authenticate with the local eve development flow.
4. Configure Sanity and Notion through Vercel Connect for the developer account before testing those connections.

The connector UIDs can be overridden with `SANITY_CONNECTOR` and `NOTION_CONNECTOR`. Do not put OAuth tokens or connector secrets in `.env` files.

## Validation

Run:

- `pnpm --filter @corleon/agent typecheck`
- `pnpm --filter @corleon/agent build`
- `pnpm typecheck`
- `pnpm build:web`

The agent package is not part of the current Vercel web build. A separate Vercel project, Connect setup, Slack trigger, deployment protection review, and production approval review are required before deploying the agent.

## Production safety boundary

No Sanity or Notion write operation is enabled without a tool-level user approval. Unknown tool names fail closed. Publishing, schema deployment, content deletion, page mutation, and release operations must remain approval-gated.

Do not provision Slack triggers, deploy the agent, add production secrets, or change the Vercel web project's build settings as part of this integration. Those steps require a separate reviewed rollout.
