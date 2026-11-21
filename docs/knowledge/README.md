# Corleon Engine Engineering Knowledge

This directory is the repository-local, reviewable catalog for verified coding-agent and software-engineering knowledge.

## Files

- `index.json` is the machine-readable catalog and deduplication index.
- `entries/` contains dated evidence reports with verified facts, analysis, Corleon relevance, security considerations, and acceptance criteria.
- `CHANGELOG.md` records each ingestion run and all additions, meaningful updates, duplicates skipped, and verification blockers.

## Entry requirements

Every saved item must include a stable ID, concise title, canonical source URL, source publication/update date, checked date, relevant product versions, evidence, maturity/limitations, Corleon applicability, implementation recommendation, security considerations, estimated effort, measurable acceptance criteria where practical, and deduplication fingerprints.

## Verification and deduplication procedure

1. Inspect this index and the relevant entry files before every write.
2. Prefer official documentation, release notes, changelogs, signed releases, standards, and security advisories. Use secondary analysis only as supporting context.
3. Confirm source authenticity, publication/update date, product/version, technical claim, maturity, and limitations.
4. Normalize the canonical URL and title. Compare the URL fingerprint, normalized-title fingerprint, key facts, and semantic meaning against existing entries.
5. Treat mirrors, reposts, paraphrases, and near-duplicates as duplicates. Do not create a second entry for the same development.
6. Update an existing entry only for a substantive version change, correction, or meaningful new evidence. Preserve prior evidence and describe the change in the changelog.
7. Separate verified facts from analysis and recommendations. Mark future announcements as `watch`, not `verified`.
8. Make documentation-only changes on a dedicated feature branch and submit a reviewable pull request. Do not write directly to `main`.

## Fingerprints

`deduplication_fingerprint` is SHA-256 of the normalized canonical source URL. `normalized_title_fingerprint` is SHA-256 of the lowercase title after punctuation and whitespace normalization. These fingerprints are stable keys, not proof of semantic uniqueness; semantic comparison remains required.

## Repository safety boundary

This knowledge catalog is documentation only. Ingestion must not modify runtime code, dependencies, Prisma schemas or migrations, secrets, environment variables, infrastructure, production settings, payment systems, or deployment configuration. Never store credentials, tokens, passwords, private keys, or sensitive personal data.

## Status values

- `verified`: primary-source facts were checked and are current as of the recorded checked date.
- `watch`: a dated official announcement exists, but the promised release or final technical details are not yet published.
- `superseded`: retained for history but replaced by a later substantive version.
- `retracted`: retained for audit history when a source or claim is corrected or withdrawn.

## Current catalog

See [`index.json`](./index.json) and the dated reports in [`entries/`](./entries/).