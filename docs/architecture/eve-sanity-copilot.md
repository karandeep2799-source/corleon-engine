# Corleon Engine: eve Sanity Copilot integration

## Status

This is a feature-branch integration, not a production release. It preserves the existing Next.js 16, React 19, Prisma/PostgreSQL, and OpenAI Agents SDK foundation.

## Architecture

- The root agent directory defines the eve content copilot.
- The existing Next.js 16 application remains the primary web application.
- The existing Next.js config uses eve/next to mount the agent alongside the app on the same Vercel project and origin.
- The agent's HTTP API is under /eve/v1/*; existing Next.js routes and API handlers remain unchanged.
- Slack is an optional channel using Vercel Connect credentials.
- Sanity and Notion are user-scoped MCP connections. Provider credentials are brokered by Vercel Connect rather than stored as static API keys.
- eve owns durable agent sessions and approval pauses. Prisma/PostgreSQL remains the source of truth for Corleon business data; no chat tables or migrations are introduced by this change.
- The existing OpenAI Agents SDK remains installed and untouched. Eve adds a separate governed content-specialist runtime rather than replacing existing agents.

## Why eve/next

The active Corleon branch uses Next.js 16 and React 19, which meet the eve/next integration requirements. This allows the agent and web app to share the existing deployment without adding a separate Vercel project or changing the existing Vercel cron configuration.

## Authorization and write safety

The HTTP eve channel accepts only Vercel OIDC requests from the corleon-engine project in preview or production, plus trusted local development requests. It is not open to browser users. A browser chat surface must wait until Corleon's application authentication is wired to a user-principal AuthFn.

The agent disables default tools. Only the explicit Sanity and Notion connections are exposed. The approval policy allows a conservative list of read-operation prefixes without approval; every unknown operation is treated as a mutation and requires user approval. Publishing, deleting, schema deployment, dataset changes, release operations, and Notion edits cannot run silently.

The model instructions are defense in depth. The framework approval gate is the actual control. If an approval prompt is not available, the agent must not execute a mutation.

## Prisma boundary

No agent conversation tables, Prisma models, migrations, or payment models are added. eve manages its own durable workflow sessions. The existing Prisma schema receives only a syntax-preserving enum formatting repair required to unblock Prisma generation; no model or database semantics change.

## Vercel Connect setup (not performed by this change)

Create and authorize connectors only after reviewing their scopes and selecting the intended Sanity project, Notion workspace, and Slack workspace:

    vercel connect create sanity --name corleon-copilot
    vercel connect create notion --name corleon-copilot
    vercel connect create slack --name corleon-copilot --triggers
    vercel connect attach slack/corleon-copilot --triggers --trigger-path /eve/v1/slack

Link each connector to the corleon-engine Vercel project and only the environments that should use it. Configure the connector UID variables from .env.example. Do not create broad provider tokens or paste long-lived credentials into source control.

## Local development

Install dependencies, then link the project to Vercel and pull development-only OIDC and connector configuration:

    npm install
    vercel link --project corleon-engine --scope karandeep2799-sources-projects
    vercel env pull
    npm run dev

For the agent terminal UI, use:

    npm run eve:dev

Do not use production connector grants for local development.

## Validation

Before production rollout, validate:

1. Prisma format, validate, and generate complete without errors.
2. eve agent typecheck and build complete.
3. Next.js production build includes the eve service and routes /eve/v1/* correctly.
4. Existing payment routes and release-commission cron remain intact.
5. Unauthenticated browser requests to the eve session API are rejected.
6. The allowed Vercel OIDC subject is limited to the Corleon project.
7. Sanity and Notion read operations work only after each user authorizes the intended workspace.
8. Create, patch, publish, delete, schema, dataset, release, and Notion mutations pause for approval.
9. Denying an approval prevents the external write.
10. Unknown tool names are approval-gated.
11. Session interruption, continuation, and approval resumption behave correctly.
12. Production rollout remains blocked until staging checks, connector scopes, and approval behavior are signed off.

## Deferred capabilities

A browser chat UI, persistent user preferences, Vercel Blob asset storage, and direct integration with Corleon's application identity provider are intentionally deferred. The inspected application does not yet expose a user-session AuthFn suitable for private browser access.
