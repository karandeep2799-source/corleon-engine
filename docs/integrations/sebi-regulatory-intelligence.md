# Corleon SEBI Regulatory Intelligence

**Status:** Feature implementation in review  
**Primary source:** https://www.sebi.gov.in/  
**Feed:** https://www.sebi.gov.in/sebirss.xml  
**Investor portal:** https://investor.sebi.gov.in/  
**Grievance portal:** https://scores.sebi.gov.in/

## Scope

The module discovers and indexes official SEBI RSS items (circulars, orders/rulings and press releases), exposes searchable source records, and provides a retrieval-grounded research assistant. It is read-only: it does not file SCORES complaints, submit regulatory filings, provide legal opinions, or execute trades.

## Architecture

- `apps/web/lib/sebi/ingestion.ts`: RSS parser, SEBI-host allowlist, category classification, content hashing and idempotent upsert.
- `apps/web/app/api/sebi/ingest/route.ts`: secret-protected POST ingestion endpoint.
- `apps/web/app/api/sebi/documents/route.ts`: read-only document search and latest-run status.
- `apps/web/app/api/sebi/ask/route.ts`: source retrieval and optional OpenAI Responses API synthesis.
- `apps/web/app/sebi/page.tsx`: regulatory dashboard.
- `prisma/migrations/20261110000300_sebi_intelligence/migration.sql`: durable document and ingestion-run storage.

## Setup

1. Configure `DATABASE_URL` in the deployment environment.
2. Generate a strong, unique `SEBI_INGEST_SECRET` and store it only in Vercel environment variables.
3. Optionally configure `OPENAI_API_KEY` and `CORLEON_SEBI_AI_MODEL` for AI synthesis. Without an AI key, source retrieval remains available.
4. Apply the migration with `pnpm prisma:deploy` from a controlled release environment.
5. Trigger ingestion with a POST request to `/api/sebi/ingest` using `Authorization: Bearer <SEBI_INGEST_SECRET>`.
6. Open `/sebi` and verify the indexed source records and citations.

## Ingestion behavior

- Only HTTPS links on `www.sebi.gov.in` and `investor.sebi.gov.in` are accepted from feed records.
- Feed size is capped at 1.5 MB and request duration at 15 seconds.
- Canonical URL is the unique key. Repeated feed entries update existing records rather than duplicating them.
- SHA-256 content hashes identify unchanged records.
- Each run records discovered, inserted, updated, status and failure details.
- The initial connector stores official RSS metadata and descriptions. Full-text extraction from every linked PDF/HTML document is a future ingestion stage and must preserve document/page evidence.

## Security and regulatory boundaries

- Ingestion is disabled unless the secret is configured; missing or invalid credentials fail closed.
- No credentials are returned to the browser.
- Search is read-only. No complaint, filing, account, order or trade mutation is exposed.
- AI synthesis must cite source IDs and state when indexed evidence is insufficient.
- Always distinguish publication date from legal effective date and verify amendments/superseding circulars.
- This is not legal, investment, tax or personalized compliance advice.
- Corleon is not affiliated with or endorsed by SEBI.

## Operations and release

- Run `pnpm prisma:generate`, `pnpm --filter @corleon/web typecheck`, `pnpm --filter @corleon/web test`, and `pnpm build`.
- The GitHub Actions schedule runs daily at 01:30 UTC (07:00 India time) only after this workflow reaches the repository default branch. Until then, workflow_dispatch can be used manually from the feature branch.
- Configure scheduled execution only after the endpoint and database migration are verified. Set the dedicated SEBI secret in both GitHub Actions and Vercel; never reuse the finance cron secret.
- Do not merge or promote this feature to production until preview checks, migration review and source-ingestion smoke tests pass.
