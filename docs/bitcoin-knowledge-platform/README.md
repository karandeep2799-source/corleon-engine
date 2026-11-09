# Corleon Bitcoin Knowledge Platform

This module adds a Bitcoin technical Q&A discovery surface and retrieval-augmented research assistant to Corleon Engine.

## Routes
- `/bitcoin` — question discovery and AI research workspace.
- `GET /api/bitcoin/questions?q=&sort=&page=` — combines Corleon community records (when the database is available) with Bitcoin Stack Exchange results.
- `GET /api/bitcoin/questions/:id` — fetches an external Stack Exchange question and its answers.
- `POST /api/bitcoin/ask` — retrieves relevant indexed knowledge (falling back to live search) and optionally synthesizes an answer using OpenAI Responses API.
- `POST /api/bitcoin/ingest` — imports a bounded set of recent Bitcoin Stack Exchange questions into PostgreSQL; requires a separate `BITCOIN_INGEST_SECRET` bearer token.

## Environment
- `DATABASE_URL` — existing PostgreSQL database.
- `OPENAI_API_KEY` — optional; without it, the AI endpoint returns retrieval-only results and citations.
- `CORLEON_BITCOIN_AI_MODEL` — optional Responses API model override; defaults to `gpt-5-mini`.
- `STACKEXCHANGE_KEY` — optional Stack Apps API key to improve API quota.
- `BITCOIN_INGEST_SECRET` — separate secret for manual ingestion; do not reuse `CRON_SECRET` because that secret is also used by existing finance cron routes.

No credentials are exposed to the browser. No wallet, signing, trading, payment or custody actions are implemented.

## Data and attribution
The external integration uses Stack Exchange API v2.3 with `site=bitcoin`, API filters and bounded pagination. External content is attributed to Bitcoin Stack Exchange and links to original posts. Observe the API Terms of Use, Network Terms and each post's applicable Creative Commons license. Do not bulk mirror community content or remove attribution/license information.

## Operational notes
- Public search endpoints cache external results for five minutes.
- AI requests are length-limited and use a bounded retrieval set.
- Retrieved post content is treated as untrusted evidence, never as system instructions.
- Local Q&A tables support pending/published/hidden questions, answers and per-user vote records. Public write endpoints and user-facing voting are intentionally not exposed until Corleon authentication, moderation and durable abuse controls are integrated.
- Ingestion is manual by default. Do not add it to the shared finance cron schedule; use the dedicated secret and an explicitly approved scheduler later.
- Database migrations are intentionally not run automatically during deployment.
