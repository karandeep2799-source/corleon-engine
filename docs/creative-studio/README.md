# Corleon Creative Studio

Tenant-scoped image generation and editing for Corleon Engine.

## Components
- Next.js 16 route handlers for the REST API.
- OpenAI GPT Image 2.5 for image generation and reference-image editing.
- BullMQ + Redis for jobs outside Vercel request lifetimes.
- Private S3-compatible object storage for source and generated images.
- PostgreSQL + Prisma for tenants, API keys, projects, jobs, references, assets, versions, agent runs, usage and audit events.
- Pepper-hashed tenant API keys; signed object URLs expire after five minutes.

## Setup
1. Copy .env.example to .env and set PostgreSQL, Redis, OpenAI and S3 secrets.
2. Run pnpm install and pnpm exec prisma generate.
3. Create migration: pnpm exec prisma migrate dev --name creative_studio.
4. Create tenant/key: pnpm creative:key "Corleon" corleon-main.
5. Start web: pnpm --filter @corleon/web dev.
6. Start worker separately: pnpm creative:worker.

## API
- POST/GET /api/v1/creative/projects
- POST /api/v1/creative/references (returns direct upload URL; PNG/JPEG/WebP, 20 MiB max)
- POST /api/v1/creative/generations (202 Accepted; requires Idempotency-Key)
- GET /api/v1/creative/generations/:id
- GET /api/v1/creative/assets?projectId=...
- POST /api/v1/creative/prompts/enhance

All endpoints require Authorization: Bearer crl_live_... . Never expose keys in browser code or NEXT_PUBLIC variables. Worker must run on a separate always-on Node 24 service (Cloud Run, Render or VPS); Vercel request handlers only enqueue jobs.

## Deployment and controls
Deploy apps/web to Vercel; provision PostgreSQL, Redis and a private encrypted S3/R2 bucket. Apply Prisma migrations as a controlled release step. Configure Redis TLS/auth, bucket lifecycle/backup/retention, and alerts for queue depth, failed jobs, provider errors and worker restarts. Provider moderation runs before generation; hashed safety_identifier is sent to OpenAI. Idempotency keys prevent duplicate jobs per tenant. API key revocation uses revokedAt.

The initial release includes an OpenAI provider adapter, API-key auth and job processing. Stripe checkout/entitlements, provider failover and a browser session UI are not claimed as implemented; integrate them with Corleon's shared billing and identity services before enabling browser-facing workflows.