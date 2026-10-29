# Corleon Engine: eve Sanity Copilot integration

## Status

This is a feature-branch integration. It is not a production release. The existing Next.js web application and Fastify API remain the platform's primary application surfaces.

## Architecture

- The root agent directory defines the eve agent.
- The existing apps/web Next.js application remains a separate Vercel service.
- The root vercel.ts uses withEve from eve/vercel to compose the Next.js service and the eve agent in one Vercel project.
- The agent is exposed at the same origin under /eve/v1/*; the web app's normal routes continue to go to the Next.js service.
- Slack is an optional channel using Vercel Connect credentials.
- Sanity and Notion are user-scoped MCP connections. Their credentials are brokered by Vercel Connect rather than stored as static provider API keys.
- eve owns durable agent sessions and approval pauses. The existing application database is not replaced and no Prisma schema is changed.

## Why Vercel services, not eve/next

The current Corleon foundation branch uses Next.js 15.5. The eve/next integration requires Next.js 16 and React 19. To avoid an unrelated framework upgrade, this integration uses the documented eve/vercel service composition. The existing Next.js config remains unchanged.

## Authorization and write safety

The HTTP eve channel accepts only Vercel OIDC requests from the corleon-engine project in preview or production, plus trusted local development requests. It is not open to browser users. A browser chat surface must wait until Corleon's application authentication is wired to a user-principal AuthFn.

The agent disables default tools. Only the explicit Sanity and Notion connections are exposed. The approval policy allows a conservative list of read-operation prefixes without approval; every unknown operation is treated as a mutation and requires user approval. Publishing, deleting, schema deployment, dataset changes, release operations, and Notion edits therefore cannot run silently.

The model instructions are defense in depth. The framework approval gate is the actual control. If an approval prompt is not available, the agent must not execute a mutation.

## Vercel service composition

The root vercel.ts preserves the existing web service and release-commission cron while allowing eve to add its own service and /eve/v1/* route. The old vercel.json is removed because the documented eve/vercel composition uses vercel.ts as the project configuration source.

The web service is built from apps/web with pnpm exec next build. The existing web app remains on its current Next.js version. The Vercel project must be linked to this repository at its root so the root config and agent directory are included.

## Connect setup (not performed by this change)

Create and authorize the connectors only after reviewing their scopes and selecting the intended Sanity project, Notion workspace, and Slack workspace:

    vercel connect create sanity --name corleon-copilot
    vercel connect create notion --name corleon-copilot
    vercel connect create slack --name corleon-copilot --triggers
    vercel connect attach slack/corleon-copilot --triggers --trigger-path /eve/v1/slack

Then link each connector to the corleon-engine Vercel project and only the environments that should use it. Configure the corresponding connector UID environment variables from the root .env.example. Do not create broad provider tokens or paste long-lived credentials into source control.

## Local development

Install dependencies from the repository root, then link the root project to Vercel and pull development-only connector/OIDC configuration:

    pnpm install
    vercel link --project corleon-engine --scope karandeep2799-sources-projects
    vercel env pull
    vercel dev --local

For agent-only terminal development, use:

    pnpm dev:agent

Do not use production connector grants for local development.

## Validation

The feature branch CI should run the agent typecheck and eve build in addition to the existing workspace typecheck and Next.js build. Before production rollout, validate:

1. The Vercel build produces both the web and eve services and routes /eve/v1/* correctly.
2. The web app's existing routes, health endpoint, and cron remain intact.
3. Unauthenticated browser requests to the eve session API are rejected.
4. The allowed Vercel OIDC subject is limited to the Corleon project.
5. Sanity and Notion read operations work only after each user authorizes the intended workspace.
6. A create, patch, publish, delete, schema, dataset, release, or Notion mutation pauses for approval.
7. Denying an approval prevents the external write.
8. Unknown tool names are approval-gated.
9. Session interruption, continuation, and approval resumption behave correctly.
10. Production deployment remains blocked until staging checks, connector scopes, and approval behavior are signed off.

## Deferred capabilities

Vercel Blob asset storage, persistent user preferences, a browser chat UI, and direct integration with the Corleon application identity provider are intentionally deferred. They require storage provisioning or application authentication that is not present in the inspected foundation branch.
