# TinyFish integration

Corleon Engine's TinyFish adapter provides a server-side gateway to TinyFish Agent, Search, Fetch, Research, Monitor, Datasets, Wallet, and Browser Context Profiles APIs.

## Architecture

- Next.js route: `POST /api/integrations/tinyfish`
- Health / wallet check: `GET /api/integrations/tinyfish`
- Server adapter: `apps/web/lib/tinyfish.ts`
- Provider API: `https://agent.tinyfish.ai`
- Authentication: server-only `TINYFISH_API_KEY` plus a separate Corleon access token.
- No TinyFish credential is exposed to browser code.
- The adapter uses native fetch and the documented REST endpoints, avoiding a runtime SDK dependency in this workspace. For standalone Node scripts, TinyFish's official SDK is `@tiny-fish/sdk`.

## Configure

Set these values in local untracked environment files and in the Vercel project's environment-variable manager:

```bash
TINYFISH_API_KEY=sk-tinyfish-...
CORLEON_TINYFISH_ACCESS_TOKEN=<long-random-secret>
```

Generate the Corleon token locally with:

```bash
openssl rand -base64 48
```

Never send either secret in chat, commit them, or use a `NEXT_PUBLIC_` prefix. Use separate TinyFish keys and Corleon access tokens for preview and production. Keep production variables unset until the integration has been reviewed and approved.

## Request format

All calls use the route with an action and an input object:

```http
POST /api/integrations/tinyfish
Content-Type: application/json
x-corleon-tinyfish-token: <CORLEON_TINYFISH_ACCESS_TOKEN>
```

Example:

```json
{
  "action": "search.query",
  "input": {
    "query": "official smartphone dealer websites in India",
    "location": "IN",
    "language": "en"
  }
}
```

For streaming browser automation, use `agent.run`. The response is the provider's Server-Sent Events stream; consume it as an event stream rather than calling `response.json()`.

## Supported actions

| Action | Purpose |
| --- | --- |
| `agent.run` | Goal-driven website automation with SSE progress |
| `search.query` | Ranked web search |
| `fetch.contents` | Extract up to 10 known URLs |
| `research.run` | Deep or max source-backed research |
| `wallet.get` | Read wallet balance and rates |
| `monitors.list/create/get/update/run/delete` | Manage scheduled page and topic monitors |
| `datasets.list/plan/create/get/rows/populate/cancel/delete` | Plan and manage structured datasets |
| `profiles.list/create/setup/save` | Manage persistent browser context |

Example agent request:

```json
{
  "action": "agent.run",
  "input": {
    "url": "https://example.com",
    "goal": "Extract the page title and summarize the public product catalogue.",
    "output_schema": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "summary": { "type": "string" }
      },
      "required": ["title", "summary"]
    }
  }
}
```

## Safety and operations

- Route requires both secrets; missing configuration fails closed.
- Provider API key is only read server-side.
- Request bodies are capped at 64 KB.
- URL inputs must be public HTTP(S); local/private IP literals and localhost are rejected.
- IDs are validated before being interpolated into provider paths.
- Provider errors retain status and code; sensitive details are omitted from production responses.
- No wallet top-up or auto-reload operation is exposed.
- No payment, publishing, account deletion, or irreversible website submission is automated by this adapter.
- Authenticated site workflows require a user-managed TinyFish Browser Context Profile. Never collect passwords in Corleon chat; use TinyFish's setup flow and Vault.
- A browser profile is persistent login state; `browser_profile: "lite" | "stealth"` is a separate runtime selection.
- Use preview deployment first. Do not add production secrets, run database migrations, or promote a deployment without approval.
- The access-token guard is a deployment gate, not a replacement for Corleon's eventual user/organization authorization and rate limiting. Put this route behind the platform's authenticated session and role checks before exposing it to multiple tenants.

## MCP setup

TinyFish exposes an OAuth 2.1 MCP endpoint at `https://agent.tinyfish.ai/mcp`. For a local Codex CLI setup:

```bash
codex mcp add tinyfish --url https://agent.tinyfish.ai/mcp
```

For ChatGPT's MCP connector, use `https://agent.tinyfish.ai/mcp/chatgpt` in the app's supported connector setup. The existing TinyFish connector in this ChatGPT workspace is already available for direct search, fetch, automation, research, monitors, datasets, and profiles.

MCP OAuth is separate from the API-key authentication used by this Corleon server adapter.

## Verification checklist

1. Configure the two environment variables in a local or Preview environment.
2. Confirm unauthenticated requests receive HTTP 401.
3. Confirm `GET /api/integrations/tinyfish` returns wallet status only with the Corleon token.
4. Run a low-cost public `search.query` request.
5. Run a public `fetch.contents` request.
6. Run `agent.run` and confirm SSE events and the final completion event.
7. Test invalid URLs, invalid IDs, missing provider credentials, and oversized bodies.
8. Confirm preview build, lint, typecheck, and tests pass before opening a production rollout.

## Official documentation

- https://docs.tinyfish.ai/llms.txt
- https://docs.tinyfish.ai/quick-start
- https://docs.tinyfish.ai/authentication
- https://docs.tinyfish.ai/for-coding-agents
- https://docs.tinyfish.ai/mcp-integration
- https://docs.tinyfish.ai/agent/api/agent
- https://docs.tinyfish.ai/search-api
- https://docs.tinyfish.ai/fetch-api
- https://docs.tinyfish.ai/research-api
- https://docs.tinyfish.ai/monitor
- https://docs.tinyfish.ai/datasets
- https://docs.tinyfish.ai/key-concepts/browser-context-profiles
