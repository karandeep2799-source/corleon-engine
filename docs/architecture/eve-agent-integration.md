# eve agent integration

## Decision

Corleon Engine keeps its existing application, API, Prisma/PostgreSQL data layer, and OpenAI Agents SDK runtime. The Vercel eve Sanity Copilot pattern is integrated as an isolated service under `agents/sanity-copilot`. It is not a replacement runtime and does not modify the existing Vercel web project.

## Included

- Independent eve package with local TUI development.
- User-scoped Vercel Connect connections for Sanity and Notion.
- Read-only tool allowlists. Unknown and mutating MCP tools require explicit human approval.
- Agent instructions requiring read-before-write and draft-first workflows.
- Slack channel adapter source, with no connector, trigger, or deployment provisioned.
- No static connector credentials and no production deployment.

## Local setup

Requirements: Node.js 24 and pnpm 10+.

```bash
cd agents/sanity-copilot
pnpm install
pnpm dev
```

Configure Sanity and Notion through Vercel Connect for the developer account before testing those connections. Connector UIDs may be overridden with `SANITY_CONNECTOR` and `NOTION_CONNECTOR`. Never put OAuth tokens or connector secrets in local environment files.

## Validation

Run `pnpm typecheck` and `pnpm build` from `agents/sanity-copilot`. Then run the existing Corleon Engine checks from the repository root. The agent package is independent of the current web deployment and does not change its build settings.

## Production safety boundary

No Sanity or Notion write operation is enabled without tool-level user approval. Unknown tool names fail closed. Publishing, schema deployment, content deletion, page mutation, and release operations must remain approval-gated.

Do not provision Slack triggers, deploy the agent, add production secrets, alter the Vercel web project's build settings, or run production migrations as part of this integration. Those steps require a separate reviewed rollout.
