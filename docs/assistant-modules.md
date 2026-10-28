# Corleon assistant modules

The 35-module catalog is inspired by the publicly documented ONLYOFFICE AI assistant feature set. It does not claim that Corleon is an ONLYOFFICE product or that these modules are native ONLYOFFICE assistants.

## API
- `GET /api/assistants?organizationId=<id>` — initialize and list 35 independent profiles for an existing organization.
- `POST /api/assistants` — execute a text-ready assistant. JSON: `{ "organizationId": "...", "assistantId": "proofreading", "input": "..." }`.
- `PATCH /api/assistants/configure` — enable/disable or set a model. JSON: `{ "organizationId": "...", "assistantId": "proofreading", "enabled": true }`.
- `GET /api/assistants/runs?organizationId=<id>&limit=25` — retrieve the latest organization-scoped run records (1–100; input payloads are not returned).

Every endpoint requires `Authorization: Bearer <CORLEON_ASSISTANTS_API_KEY>`. This machine-to-machine secret is not a substitute for user identity or organization-membership authorization. Never expose it to browser code. Put these endpoints behind a trusted backend/API gateway and add user/session authorization before end-user exposure.

Configure `DATABASE_URL`, `OPENAI_API_KEY`, `CORLEON_ASSISTANTS_API_KEY`, and optionally `OPENAI_BALANCED_MODEL` and `CORLEON_ASSISTANT_MAX_OUTPUT_TOKENS`. The SQL migration is additive and assumes the existing Corleon schema (including `Organization`) has already been deployed. Verify against a staging database before running `npm run prisma:deploy`. This repository currently has no full initial/baseline migration, so do not apply this isolated migration to an empty database; establish a baseline for fresh-database provisioning first.

## Readiness
Text-ready profiles are enabled by default; modules needing document, image, workspace, or MCP adapters start disabled and return HTTP 501 until the actual adapter exists. Image Generator drafts prompts but does not create image files. PDF/OCR organizes extracted text but does not parse binary PDFs. Data Analyst uses only supplied data. Fact Check does not browse.

## Production checklist
- Run history is stored in `AssistantRun`; do not submit secrets or unnecessary personal data.
- Model IDs must be enabled for your OpenAI account; syntactic validity does not prove availability.
- Add rate limits, quotas, and request logging at the gateway before public exposure.
- Define retention/deletion for stored prompts, outputs, and errors.
- Add provider-specific adapters and integration tests before enabling document/file side effects or MCP tools.
