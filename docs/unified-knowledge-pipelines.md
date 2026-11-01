# Corleon Engine — Unified Knowledge Pipelines

## Goal

Make approved knowledge sources available through one governed ingestion layer to research, coding, business, learning and general assistant agents. A source is not globally trusted merely because it can be fetched. Every document carries tenant scope, provenance, rights status, timestamps, content mode and a content hash.

## Reference architecture

```text
Sources
  ├─ Public RSS / issuer IR feeds
  ├─ SEC EDGAR filings
  ├─ Licensed Sabrient scorecards / market-data vendors
  ├─ Seeking Alpha RSS metadata and article links
  ├─ Authorized GitHub repositories
  ├─ Authorized Notion exports/API
  └─ User-uploaded documents
          |
          v
Connector adapters (allowlists, auth, rate limits, size limits)
          |
          v
Rights & source-policy gate
          |
          v
Normalize -> hash -> deduplicate -> chunk -> quarantine scan
          |
          v
Queue / retry / dead-letter (host runtime integration)
          |
          v
Tenant-scoped PostgreSQL knowledge store
          |
          +--> lexical search / metadata filters
          +--> optional embeddings / vector retrieval
          |
          v
Evidence pack with source links, timestamps, rights and confidence
          |
          v
Research / coding / business / learning agents
          |
          v
Audit log, feedback, freshness checks and source health
```

## Shared source taxonomy

- Finance: Seeking Alpha metadata, Sabrient licensed rankings, SEC filings, company IR, earnings transcripts, market-data vendors.
- Engineering: GitHub repositories, issues, PRs, technical documentation, release notes and CI logs.
- Workspace: Notion pages, approved Dropbox/Drive documents and meeting notes.
- Learning: user-uploaded books/materials, course notes and structured exercises.
- Operations: incident records, deployment events, support conversations and approved internal SOPs.

## Trust and evidence model

1. Primary issuer/regulator filings outrank secondary commentary for reported facts.
2. Vendor rankings are labeled as vendor methodology, not objective truth.
3. Commentary/opinions remain attributed to the author and are never converted into facts.
4. Model-generated summaries must link to exact source documents and quote/offset evidence where feasible.
5. Conflicting facts are retained with timestamps and source hierarchy; the system does not silently overwrite them.
6. Stale market values and forecasts are labeled with their as-of timestamps.
7. Retrieved content is untrusted input, not agent instructions.

## Initial source rollout

### Phase 1 — Foundation
Source registry, rights gate, canonical document schema, deduplication, tenant-scoped repository, ingestion receipts, audit trail, lexical search and queue contracts.

### Phase 2 — First connectors
SEC EDGAR metadata, issuer RSS/Atom feeds, Seeking Alpha RSS metadata, user-uploaded documents and allowlisted GitHub files.

### Phase 3 — Licensed and workspace connectors
Sabrient licensed scorecards, market-data providers, Notion and other workspace sources. Enable only after credentials and rights are configured.

### Phase 4 — Retrieval and agent federation
Add embeddings, hybrid search, citations, freshness scoring and role-based retrieval policies. Connect earnings-intelligence, coding, business and learning agents through the same read-only retrieval contract.

## Seeking Alpha and Sabrient constraints

Seeking Alpha's terms prohibit automated scraping/data mining and restrict redistribution and subscription-content sharing. The initial connector therefore supports feed metadata and outbound article links only. Full article ingestion requires written permission that explicitly covers the intended use.

Sabrient describes proprietary quantitative models and rankings. There is no assumption of an unrestricted public data API. Import scorecards only under an applicable license or explicit user-authorized data-use rights, retaining the license reference and permitted-use scope.

## Operational SLOs to establish in staging

- Idempotent ingestion: same tenant/source/external ID never creates duplicate documents.
- Retry: transient errors use exponential backoff with jitter; permanent policy failures do not retry.
- Isolation: no cross-tenant source lookup, document retrieval, embeddings or audit visibility.
- Freshness: source-specific expected update intervals; late feeds alert without fabricating data.
- Observability: per-source last-success, lag, error class, documents ingested, duplicates, bytes, queue depth and dead-letter count.
- Recovery: replay by source and time window; deletion propagates to chunks and embeddings.

## Production gate

No production database migration, source credential activation, data backfill, paid vendor connection or production deployment is authorized by this change. Those require source-by-source rights review, implementation of the host persistence/auth/queue adapters, staging tests, migration review and explicit approval.
