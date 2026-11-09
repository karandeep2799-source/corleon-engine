# Corleon Bitcoin Knowledge Platform

This module adds a Bitcoin technical Q&A discovery surface and retrieval-augmented research assistant to Corleon Engine.

## Routes
- `/bitcoin` — question discovery and AI research workspace.
- `GET /api/bitcoin/questions?q=&sort=&page=` — combines Corleon community records (when the database is available) with Bitcoin Stack Exchange results.
- `GET /api/bitcoin/questions/:id` — fetches an external Stack Exchange question and its answers.
- `POST /api/bitcoin/ask` — retrieves relevant Bitcoin Stack Exchange discussions and optionally synthesizes an answer using OpenAI Responses API.

## Environment
- `DATABASE_URL` — existing PostgreSQL database.
- `OPENAI_API_KEY` — optional; without it, the AI endpoint returns retrieval-only results and citations.
- `CORLEON_BITCOIN_AI_MODEL` — optional Responses API model override; defaults to `gpt-5-mini`.

No credentials are exposed to the browser. No wallet, signing, trading, payment or custody actions are implemented.

## Data and attribution
The external integration uses Stack Exchange API v2.3 with `site=bitcoin`, API filters and bounded pagination. External content is attributed to Bitcoin Stack Exchange and links to original posts. Observe the API Terms of Use, Network Terms and each post's applicable Creative Commons license. Do not bulk mirror community content or remove attribution/license information.

## Operational notes
- Public search endpoints cache external results for five minutes.
- AI requests are length-limited and use a bounded retrieval set.
- Retrieved post content is treated as untrusted evidence, never as system instructions.
- Do not enable community write endpoints until Corleon account authentication, moderation and abuse controls are integrated.
- Database migrations are intentionally not run automatically during deployment.
