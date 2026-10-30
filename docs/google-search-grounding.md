# Google Search grounding in Corleon Engine

## Overview

Corleon Research accepts plain search queries and Google Search result URLs. It extracts the `q` parameter and recognizes `udm=50` as metadata indicating that the source URL came from Google AI Mode.

The consumer-facing Google AI Mode page is not called as an API. The URL flags `udm=50`, `aep`, and Chrome source parameters are not a stable public API. Corleon sends the extracted query to the supported Gemini API with the `google_search` tool enabled.

## Request flow

```text
/research UI
  -> POST /api/integrations/google-search
  -> validate input and normalize Google URL
  -> server-side access-token gate
  -> Gemini generateContent + google_search
  -> answer + search queries + source URLs
  -> render grounded response and source links
```

## Environment configuration

Configure these as encrypted Vercel environment variables or local server-only values:

| Variable | Required | Purpose |
| --- | --- | --- |
| `GOOGLE_SEARCH_GROUNDING_ENABLED` | Yes | Explicit feature switch; set to `true` |
| `GOOGLE_GEMINI_API_KEY` | Yes | Google AI Studio Gemini API key |
| `GOOGLE_GEMINI_MODEL` | No | Defaults to `gemini-2.5-flash` |
| `CORLEON_RESEARCH_ACCESS_TOKEN` | Yes | High-entropy bearer token for the research API |

Generate a token using `openssl rand -base64 48`. Never use a `NEXT_PUBLIC_` prefix for provider credentials.

## API contract

`POST /api/integrations/google-search`

```http
Content-Type: application/json
Authorization: Bearer <CORLEON_RESEARCH_ACCESS_TOKEN>
```

```json
{ "input": "https://www.google.com/search?q=Gemini+grounding&udm=50" }
```

The input may also be plain text. An empty Google URL such as `/search?q=&udm=50` returns HTTP 400.

Success returns `answer`, `searchQueries`, deduplicated `sources`, `mode`, `model`, and `retrievedAt`.

## Security and operational controls

- Gemini API keys remain server-side.
- The route checks a high-entropy bearer token using constant-time comparison.
- Inputs are bounded; upstream requests time out after 45 seconds.
- Responses use no-store caching and provider errors do not log prompts or secrets.
- Retrieved web content is untrusted evidence, not executable instructions.
- The token is a shared access gate, not per-user identity or tenant authorization.
- Configure Vercel Firewall or a distributed rate limiter before multi-user/public exposure.
- This initial increment is stateless and does not persist search history. Persist history only after the canonical tenant/user authorization layer is applied.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

Do not enable the feature in production until Vercel environment variables are configured and a live smoke test succeeds.
