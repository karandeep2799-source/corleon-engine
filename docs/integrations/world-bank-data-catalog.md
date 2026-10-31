# Corleon Global Data Intelligence — World Bank Data Catalog

## Scope

This integration connects Corleon Engine to the World Bank's public Data Catalog API. It discovers datasets and exposes their metadata, resources, indicators and citations. It is a metadata and resource-discovery integration; it is not a substitute for the World Bank Indicators API time-series service.

## Upstream API

- OpenAPI 2.0 reference: https://ddh-openapi.worldbank.org/docs/index.html
- OpenAPI JSON: https://ddh-openapi.worldbank.org/docs/2.0/document.json
- Developer documentation: https://datahelpdesk.worldbank.org/knowledgebase/topics/125589-developer-information
- Catalog: https://datacatalog.worldbank.org/
- API base: https://ddh-openapi.worldbank.org

The legacy help-desk article documents the earlier \`/ddhxext/*\` interface and labels its documentation provisional. This implementation targets the current published OpenAPI 2.0 routes (\`/datasets\`, \`/search\`, \`/resources\`, \`/indicators\`, \`/citations\`) instead of coupling the application to legacy endpoints.

## Routes

| Corleon route | Method | Purpose |
| --- | --- | --- |
| \`/api/global-data/datasets?top=25&skip=0\` | GET | Browse published datasets |
| \`/api/global-data/search?q=climate&type=dataset\` | GET | Search datasets or resources |
| \`/api/global-data/datasets/:datasetId\` | GET | Retrieve dataset, resources, indicators and citations |
| \`/api/global-data/sync\` | POST | Synchronize recent dataset metadata into PostgreSQL |

The sync route requires \`Authorization: Bearer $CRON_SECRET\`. It is read-only against the World Bank and only writes Corleon's own metadata cache.

## Environment

Copy \`apps/web/.env.example\` and configure:

- \`DATABASE_URL\`: PostgreSQL connection string.
- \`CRON_SECRET\`: random secret of at least 32 characters, configured in the deployment environment.
- \`WORLD_BANK_API_BASE_URL\`: optional; defaults to the official HTTPS API host.

No World Bank API key is required by the public API documented here. Do not put secrets in browser code.

## Database and synchronization

The Prisma models store dataset metadata, source version references, resources, indicators, citations and sync execution history. Synchronization uses the \`/datasets/recent\` endpoint and upserts by the stable \`dataset_unique_id\`. Full-catalog harvesting should be performed as a bounded paginated worker rather than a single Vercel request.

## Operational safeguards

- Input pagination is bounded to 100 records per request.
- Search terms are length-validated.
- Upstream requests have a 12-second timeout.
- Upstream errors are mapped to safe client responses.
- Sync requests require a constant-time bearer-token comparison.
- External metadata is treated as untrusted data; never pass it to AI agents as executable instructions.
- Verify each dataset's terms, license, attribution and redistribution restrictions before reuse.
- The World Bank's API and dataset metadata can change; monitor the published OpenAPI specification for contract changes.

## Release procedure

1. Provision PostgreSQL and set \`DATABASE_URL\`.
2. Configure \`CRON_SECRET\` and optionally \`WORLD_BANK_API_BASE_URL\` in the Vercel project.
3. Run \`pnpm --filter @corleon/web prisma:deploy\` as a controlled release migration.
4. Run \`pnpm --filter @corleon/web prisma:generate\`, then lint, typecheck, tests and production build.
5. Verify the dataset list, search, detail and authenticated sync routes in a non-production environment.
6. Configure a scheduled caller for \`POST /api/global-data/sync\` only after the preview environment has been validated.

No production deployment or database migration is performed by this feature branch.
