# Corleon Images API
Private, workspace-scoped image generation and asset APIs for Corleon Engine.

## Environment
Set server-only secrets in Vercel: DATABASE_URL, OPENAI_API_KEY, IMAGES_API_TOKEN (32+ random chars), IMAGES_STORAGE_BUCKET, IMAGES_STORAGE_REGION, IMAGES_STORAGE_ACCESS_KEY_ID, IMAGES_STORAGE_SECRET_ACCESS_KEY, and NEXT_PUBLIC_APP_URL. Optional: IMAGES_STORAGE_ENDPOINT and IMAGES_MODEL (defaults to gpt-image-2.5-sunburst). Keep the S3/R2 bucket private with server-side encryption.

## Deploy
Provision PostgreSQL and private S3-compatible storage. Run `pnpm --filter @corleon/web db:generate`, then `pnpm --filter @corleon/web db:migrate` as a release step. Deploy the feature branch through a PR after CI. Routes use Node.js runtime and allow 60 seconds for provider requests.

## Authentication
All endpoints except public share resolution require `Authorization: Bearer $IMAGES_API_TOKEN`. This initial integration is deliberately single-workspace (`corleon-workspace`); add authenticated principal resolution and tenant RBAC before exposing to multiple customers.

## Endpoints
- POST /api/images/generations — prompt generation; optional templateId, variables, size and quality. Supports Idempotency-Key.
- POST /api/images/edits — {sourceAssetId,prompt}.
- POST /api/images/sketch — {sourceAssetId,prompt?}; preserves sketch composition.
- GET /api/images/history?limit=20&cursor=... — cursor-paginated asset history.
- GET /api/images/assets/:assetId — asset metadata and fresh signed URL.
- GET/POST /api/images/templates — list built-ins/custom templates; create custom template.
- POST /api/images/assets/:assetId/share — {expiresInHours?}; omit for no expiry.
- GET /api/images/shared/:token — public share resolution.
- POST /api/images/shares/:shareId/revoke — revoke share.

Signed asset URLs expire after 15 minutes. Public shares are unguessable bearer links stored as token hashes; revocation prevents future resolution. Treat links as secrets.

## Operations
OpenAI API key and storage credentials never leave the server. Do not log prompt content, tokens, share secrets or image bytes. Configure upstream request/body limits. Idempotency keys are scoped to the workspace. Image model access may require OpenAI organization verification. For high-volume or long-running work, move provider calls to a durable queue/worker; this synchronous first release is bounded by Vercel function duration. Add quotas, retention/deletion controls, audit events, and end-user RBAC before multi-tenant production.
