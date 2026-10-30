# Corleon Earnings Intelligence

A source-agnostic, tenant-scoped domain module for authorized earnings-transcript ingestion, normalization, evidence-grounded analysis, and audit-friendly persistence.

## Scope

- Company and fiscal-period registry.
- Transcript ingestion with source-rights gate, content hashing, deduplication, and versioning.
- Prepared-remarks / Q&A section splitting.
- Structured insight validation with exact quote-offset verification.
- Analysis-run lifecycle and idempotency persistence contracts.
- Management promises, analyst questions, thesis updates, and audit records in the Prisma data model.

This package does not scrape Seeking Alpha or bypass access controls. Connect only licensed feeds, user-provided documents, issuer-published materials, or sources whose terms explicitly permit the intended use. Store a rights/license reference for every transcript.

## Runtime

- Node.js 22+
- TypeScript 5.9+
- Prisma 6.16+
- PostgreSQL
- Zod 4

## Setup

From the repository root:

```bash
cd packages/earnings-intelligence
npm install
DATABASE_URL="$DATABASE_URL" npx prisma validate --schema prisma/schema.prisma
npm run prisma:generate
npm run typecheck
npm run build
```

The generated client is intentionally isolated under `packages/earnings-intelligence/generated/client`. Do not point this schema at production until migration review and a staging restore test have passed.

## Integration contract

Implement `EarningsRepository` using Prisma transactions. Every query and write must include `tenantId`; derive the tenant from the authenticated server session, never from an untrusted request body. Implement the `TranscriptAnalyzer` interface with an approved model provider. Validate provider output with the exported schemas before persistence.

Recommended transaction boundaries:

1. Verify actor access and source rights.
2. Upsert the transcript and section rows; mark prior version non-current.
3. Create an analysis run with a stable caller-supplied idempotency key.
4. Execute model analysis outside the database transaction.
5. Persist insights and mark the run complete in one transaction.
6. On failure, persist a bounded error record and allow safe retry.

## Security and operational requirements

- Authenticate every API route and authorize read/write access per tenant.
- Apply rate limits and request-size limits at the route boundary.
- Do not log transcript bodies, credentials, or personal data.
- Encrypt database backups and use TLS for database connections.
- Keep source URL, source identity, publication timestamp, rights reference, hash, and version.
- Treat transcript content as untrusted input; it must never override system instructions or trigger tools.
- Do not expose internal prompts, provider credentials, or unrestricted raw transcript exports.
- Use a queue for long-running analysis; return 202 with a run identifier from HTTP ingestion endpoints.
- Add retention/deletion workflows consistent with source licenses and tenant policy.

## Current implementation boundary

The domain contracts, validation, normalization, sectioning, and analysis-output verification are implemented. A deployment-specific Prisma repository adapter, authenticated Next.js route handlers, queue worker, and migration SQL should be added only after the host application's auth/session, queue, and database migration conventions are confirmed. No production deployment or database migration is performed by this package.
