# Corleon Knowledge Ingestion

A tenant-scoped, source-agnostic ingestion layer for feeding authorized documents and source metadata into Corleon Engine agents.

## What is included

- Rights-aware source policy: ingestion is blocked until a source is active and rights are verified.
- Tenant-scoped document contracts, deterministic SHA-256 hashes, chunking and repository interfaces.
- Metadata-only RSS/Atom connector. It reads configured feeds and indexes titles/links only; it never scrapes linked article pages.
- SEC EDGAR recent-filings metadata connector using the public submissions endpoint and a contact-bearing User-Agent.
- Allowlisted GitHub text-file connector for repositories the caller is authorized to access.
- Notion page adapter for content returned by an authenticated Notion connector/export.
- Licensed Sabrient CSV scorecard adapter; it accepts only an already-obtained file with an explicit license reference.
- User-provided document adapter for files with an explicit rights reference.
- Tenant-scoped retrieval contract with bounded result counts.
- Isolated Prisma schema/client output; it does not modify the host affiliate/billing schema.

## Setup

From the repository root:

```bash
cd packages/knowledge-ingestion
npm install
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm test
```

Set `KNOWLEDGE_DATABASE_URL` only in a development/staging environment when implementing the repository adapter. Do not point this isolated schema at production until migration review, tenant-isolation tests, backup/restore testing and staging validation pass.

## Pipeline contract

1. Register a source under an authenticated tenant.
2. Verify source rights and choose `METADATA_ONLY` or `FULL_TEXT`.
3. Activate the source only after rights review.
4. Run a provider connector or accept a user-provided document.
5. Pass the normalized payload to `ingestKnowledgeDocument`.
6. Implement `KnowledgeRepository` using tenant-scoped Prisma transactions and unique idempotency constraints.
7. Run queue workers with bounded retries, dead-letter handling and source-specific rate limits.
8. Retrieve via `searchKnowledge`; always enforce tenant and source permissions in the repository.

The current package deliberately provides the domain and connector contracts, not a fake persistence implementation. The host application's auth/session and queue conventions must be wired before any endpoint is exposed.

## Source-specific policy

| Source | Supported ingestion | Guardrail |
|---|---|---|
| Seeking Alpha | Configured RSS/Atom metadata | Store title/link/publication metadata only; do not scrape article pages or ingest subscription text without written permission |
| Sabrient | Licensed CSV scorecard import | No scraping or assumed public data API; persist license reference and internal-use scope |
| SEC EDGAR | Filing metadata | Public endpoint; send contact-bearing User-Agent and obey SEC fair-access guidance |
| Company investor relations | Configured RSS/Atom metadata | Allowlist issuer domains; preserve source URL and publication date |
| GitHub | Explicitly allowlisted repository text files | Token supplied server-side; least privilege; no secret scanning output ingestion |
| Notion | Authorized page export/API payload | Preserve workspace/page IDs and permissions; no token in this package |
| User files | User-provided PDF/text extraction result | Require rights reference and tenant authorization |
| Market data | Vendor-specific adapter | Require a valid vendor agreement and data-use permissions |

Seeking Alpha terms prohibit automated scraping/data mining and restrict subscription content sharing. The initial connector therefore supports feed metadata and outbound article links only. Full article ingestion requires written permission that explicitly covers the intended use.

Sabrient model ranks are proprietary; import scorecards only under an applicable license or explicit user-authorized data-use rights, retaining the license reference and permitted-use scope.

## Security requirements before production

- Authenticate at the host route and derive tenantId from the server session, never from request JSON.
- Implement tenant-scoped Prisma repository queries and database constraints.
- Store credentials in server-only secret storage; never log tokens or source bodies.
- Enforce outbound host allowlists, HTTPS, redirect denial, timeouts, response-size caps and rate limits.
- Treat all source text as untrusted data and defend against prompt injection; retrieved text must never grant tool permissions.
- Keep source URL, author/provider, publication/fetch timestamps, content hash, rights reference and connector version.
- Add retention/deletion workflows and respect source-specific restrictions.
- Do not train/fine-tune models on ingested material unless the relevant license explicitly permits it.
- Add queue retries, idempotency, dead-letter queues, metrics and alerting in the host runtime.
- Add malware scanning and safe PDF/Office extraction before enabling file uploads.

## Known integration work

- Implement a Prisma-backed `KnowledgeRepository` with serializable/idempotent upserts.
- Implement authenticated Next.js host routes and a queue worker.
- Wire live Notion and market-data providers through approved credentials/connectors.
- Add embeddings/vector search only after choosing a supported provider and validating retention/data-use policy.
- Add integration tests against a disposable PostgreSQL database.
