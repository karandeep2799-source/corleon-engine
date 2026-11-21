# Corleon Sanity Copilot

An isolated eve agent workspace inspired by Vercel's Sanity Copilot template. It complements Corleon Engine's existing application and API; it does not replace the current OpenAI Agents SDK runtime, Prisma/PostgreSQL layer, or Vercel web deployment.

## Requirements

- Node.js 24
- pnpm 10+
- Vercel Connect access for each user who will connect Sanity or Notion

## Local development

From this directory:

```bash
pnpm install
pnpm dev
```

Use the local eve TUI to authenticate and exercise the agent. Copy `.env.example` to `.env` only if connector UIDs or the model need overriding. Do not put API keys, OAuth tokens, or passwords in this file.

## Connections

Sanity and Notion use user-scoped Vercel Connect OAuth. Each person must authorize their own account. Read operations are allowlisted; all other and unknown MCP tools require an explicit user approval.

Slack channel code is included but no Slack connector or event trigger is provisioned. Enable it only after local validation and a separate deployment review.

## Validation

```bash
pnpm typecheck
pnpm build
```

The agent is not part of the existing Vercel web project's build command. Deploying it requires a separate Vercel project and explicit review of Connect grants, Slack event triggers, environment configuration, deployment protection, and approval policy.
