# Google Search grounding integration

## What this adds

Corleon Research accepts plain search queries and Google Search result URLs. It extracts the `q` parameter, recognizes `udm=50` as an AI Mode-origin URL, and runs the query through the supported Gemini API with the `google_search` tool enabled.

The consumer Google AI Mode page is not called as an API. URL flags such as `udm=50`, `aep`, and Chrome source parameters are input metadata only. They are not treated as a stable API contract.

## Architecture

```text
Research UI (/research)
  -> POST /api/integrations/google-search
  -> input validation + Google URL normalization
  -> server-side access-token check
  -> Gemini generateContent + google_search grounding
  -> answer + search queries + grounded source URLs
  -> UI renders answer and source links
```

Provider credentials never reach the browser. The API route is Node.js runtime and does not cache requests or responses.

## Configuration

Set these variables in the Vercel project or local server environment:

| Variable | Required | Description |
| --- | --- | --- |
| `GOOGLE_GEMINI_API_KEY` | Yes | Google AI Studio Gemini API key |
| `GOOGLE_GEMINI_MODEL` | No | Model ID; defaults to `gemini-2.5-flash` |
| `GOOGLE_SEARCH_GROUNDING_ENABLED` | Yes | Set to `true` to enable the integration |
| `CORLEON_RESEARCH_ACCESS_TOKEN` | Yes | High-entropy server-side bearer token used by the research UI |

Generate a high-entropy access token, for example:

```bash
openssl rand -base64 48
```

Do not commit populated values. Add them to Vercel's encrypted environment variables and redeploy.

## API

`POST /api/integrations/google-search`

Headers:

```http
Content-Type: application/json
Authorization: Bearer <CORLEON_RESEARCH_ACCESS_TOKEN>
```

Body:

```json
{ "input": "https://www.google.com/search?q=Gemini+grounding&udm=50" }
```

The `input` field can also be a plain-text query. Empty Google URLs such as `/search?q=&udm=50` return HTTP 400 with a clear validation message.

Successful responses include:

- `answer`: Gemini's grounded answer.
- `searchQueries`: queries issued by Google Search grounding.
- `sources`: deduplicated source URLs and titles from grounding metadata.
- `mode`: whether the submitted URL originated from a Google AI Mode URL or ordinary Google Search.
- `retrievedAt`: server timestamp.

## Security and operations

- Keep `GOOGLE_GEMINI_API_KEY` server-only.
- The UI holds the research access token in component memory only; it is not written to local storage.
- The API uses constant-time token comparison, strict input bounds, a 45-second upstream timeout, no-store response caching, and bounded output tokens.
- Google provider errors are logged as status metadata only; prompts and credentials are not logged.
- Retrieved web pages are treated as untrusted evidence and cannot override Corleon policy.
- Add Vercel Firewall or a distributed rate limiter before exposing this endpoint to multiple users. The bearer token is an access gate, not per-user identity or tenant authorization.
- This first increment does not persist research history. Add Prisma-backed history only after wiring the deployment's canonical Prisma client and tenant/user identity provider.

## Verification

Run from the repository root:

```bash
pnpm --filter @corleon/web test
pnpm --filter @corleon/web typecheck
pnpm --filter @corleon/web build
```

The CI checks should be treated as the final merge gate. Do not enable the integration in production until the Vercel environment variables are configured and a smoke test succeeds.
