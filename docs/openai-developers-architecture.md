# OpenAI Developers / Codex architecture

Corleon Engine now has the foundation for an OpenAI-powered developer-agent layer.

## Layers

1. Codex/OpenAI Developers plugin: developer-facing skills and MCP connection.
2. Agent runtime: architect, coder, and reviewer agents.
3. MCP gateway: least-privilege tools for repository, database, testing, and deployment operations.
4. PostgreSQL/Prisma: application data plus durable agent-run/audit records when the host Next.js application adds the control-plane models.
5. GitHub: branch/PR based changes.
6. Vercel: preview-first deployments; production promotion requires approval.

## Agent lifecycle

inspect -> plan -> implement -> test -> review -> preview -> verify -> approve -> production

## Tool policy

| Capability | Policy |
|---|---|
| Repository read/search | allow |
| Prisma inspection | allow |
| Tests | allow |
| Preview deployment | allow |
| Repository writes | approval_required |
| Database writes | approval_required |
| Prisma migrations | approval_required |
| Production deployment | approval_required |
| Secrets | deny |
| Production database access | deny |

## Next.js host integration

The current `corleon-engine` repository is a Node/Prisma engine rather than a Next.js App Router application. Therefore this change intentionally adds the reusable agent/runtime and Codex skill layer without inventing Next.js route files in the wrong repository.

In the Next.js host, expose a server-only `/api/ai` route and an authenticated `/api/mcp` gateway. The route should authenticate the user, resolve organization membership/RBAC, create an agent-run record, invoke the Responses API/Agents SDK, stream the result, and persist tool calls and approvals.

Never put `OPENAI_API_KEY`, GitHub tokens, Vercel tokens, or MCP gateway secrets in client-side environment variables.
