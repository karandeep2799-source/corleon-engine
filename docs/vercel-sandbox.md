# Vercel Sandbox integration

Corleon Engine exposes authenticated, bounded code execution through the Next.js app.

## API

- `POST /api/sandbox/jobs` — execute a Node.js or Python program in an isolated Vercel Sandbox microVM.
- `GET /api/sandbox/jobs` — list the latest 20 jobs (metadata only).
- `GET /api/sandbox/jobs/:jobId` — fetch one job and its bounded output.

All routes require `Authorization: Bearer <CORLEON_SANDBOX_API_KEY>`. Generate a random secret of at least 32 characters and configure it as a server-only environment variable in Vercel and local development. Never use a `NEXT_PUBLIC_` prefix.

Example:

```bash
curl -X POST "$APP_URL/api/sandbox/jobs" \
  -H "Authorization: Bearer $CORLEON_SANDBOX_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: sandbox-job-2026-0001" \
  --data '{"runtime":"node","code":"console.log(1 + 1)"}'
```

## Security model

- Only Node.js and Python runtimes are accepted; arbitrary shell commands and package installation are not exposed.
- Each run is created with `networkPolicy: "deny-all"`, a 1-vCPU resource limit, and a 15-second sandbox timeout.
- No application environment variables or production credentials are forwarded into the guest.
- Source code is hashed for audit correlation and is not stored in PostgreSQL.
- Output is capped at 16 KB per stream; source input is capped at 12 KB.
- Requests use a constant-time comparison for the bearer key, a constrained idempotency key, no-store responses, and request IDs.
- A database audit record is written for start and completion/failure.

The deny-all network policy is intentionally strict. Do not loosen it to allow arbitrary internet access for generated code. If a future workflow needs dependencies, install them in a separate trusted setup stage and then apply a restrictive policy before executing untrusted code.

## Required environment

- `DATABASE_URL`: PostgreSQL connection string.
- `CORLEON_SANDBOX_API_KEY`: server-only random bearer secret, minimum 32 characters.
- Vercel Sandbox authentication: Vercel OIDC is preferred for a Vercel-hosted deployment. For local development, link the project and pull the development environment as described in the [official docs](https://vercel.com/docs/sandbox).

## Database setup

Run from the repository root:

```bash
pnpm --filter @corleon/db generate
pnpm exec prisma migrate dev --schema packages/db/prisma/schema.prisma --name add_sandbox_jobs
```

For production, commit the generated migration and run `prisma migrate deploy --schema packages/db/prisma/schema.prisma` as a release step before enabling the API routes.

## Operational notes

The API executes a job inline so the HTTP response contains the final result. Keep the sandbox timeout shorter than the hosting function timeout. For durable long-running agent jobs, move execution to a dedicated worker/queue and have the API return a job ID immediately.
