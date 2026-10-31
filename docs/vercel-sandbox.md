# Corleon Engine — Vercel Sandbox

Corleon runs generated or otherwise untrusted code in one-off Vercel Sandbox Firecracker microVMs. The application server never evaluates submitted source code.

## Application API

All endpoints require `Authorization: Bearer <CORLEON_SANDBOX_API_KEY>`.

- `POST /api/sandbox/jobs` — run a bounded Node.js or Python job.
- `GET /api/sandbox/jobs` — list the latest 20 jobs for the configured tenant (metadata only).
- `GET /api/sandbox/jobs/:jobId` — retrieve one tenant-scoped job, bounded output, and audit events.

Example:

```bash
curl -X POST "$APP_URL/api/sandbox/jobs" \
  -H "Authorization: Bearer $CORLEON_SANDBOX_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: sandbox-job-2026-0001" \
  --data '{"runtime":"node","code":"console.log(1 + 1)","timeoutMs":15000}'
```

A successful response includes the persisted job, exit code, output, and duration. A non-zero program exit returns HTTP 422. Execution timeouts return HTTP 408.

## Execution policy

- Only Node.js and Python are accepted; shell commands, environment injection, package installation, and arbitrary CLI commands are not exposed through the application API.
- Every job uses a new non-persistent microVM, 1 vCPU, a maximum 30-second execution timeout, and `networkPolicy: "deny-all"`.
- No application environment variables, database credentials, provider keys, or Vercel OIDC token are passed into the guest.
- Source code is SHA-256 hashed for audit correlation and is not stored in PostgreSQL.
- Source input is capped at 12 KiB; stdout and stderr are each capped at 16 KiB.
- Bearer credentials are compared using fixed-length SHA-256 digests and a constant-time comparison.
- Idempotency keys are tenant-scoped. Job reads are tenant-scoped.
- API responses are marked `Cache-Control: no-store`; request IDs are returned for tracing.
- Database records persist job status and audit events. Sandbox cleanup runs in `finally`; platform timeout is a second cleanup boundary.

This is a synchronous, short-job API. Do not use it for multi-minute agent sessions, persistent development servers, or interactive shells. Those should use a durable worker/orchestrator and persistent named sandboxes with explicit approval and lifecycle policies.

## Environment

Required:

- `DATABASE_URL` — existing Corleon PostgreSQL database.
- `CORLEON_SANDBOX_API_KEY` — random server-only secret of at least 32 characters.
- `CORLEON_SANDBOX_TENANT_ID` — tenant scope for this service credential.

Authentication:

- On Vercel, Sandbox uses the deployment's Vercel OIDC identity automatically.
- Locally, run `vercel link` and `vercel env pull` to obtain a development `VERCEL_OIDC_TOKEN`.
- Outside Vercel OIDC-enabled deployments, configure `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID`. These credentials are used only by the host SDK and are never passed into the guest.

Never prefix secrets with `NEXT_PUBLIC_`, commit real credentials, or send production database/provider secrets to a sandbox.

## Database migration

The integration adds `SandboxJob` and `SandboxAuditEvent` to the existing `apps/web/prisma/schema.prisma` schema and uses the existing `DATABASE_URL`. It does not create a second Prisma schema or database.

Run:

```bash
pnpm --filter @corleon/web db:generate
pnpm --filter @corleon/web db:migrate
```

For a controlled production rollout, first back up PostgreSQL, review the generated migration against the committed SQL, deploy the migration as a release step, then configure the API key and enable the integration.

## CLI reference

Install and authenticate:

```bash
pnpm add -g sandbox
sandbox login
sandbox --help
```

The Vercel CLI also exposes these commands (Vercel CLI v54.15.1 or later):

```bash
vercel sandbox create --name corleon-dev
vercel sandbox run -- node --version
vercel sandbox exec corleon-dev -- pnpm test
vercel sandbox connect corleon-dev
vercel sandbox list
vercel sandbox stop corleon-dev
```

The standalone CLI supports file transfer and lifecycle operations:

```bash
sandbox copy ./artifact.txt corleon-dev:/vercel/sandbox/
sandbox stop corleon-dev
sandbox remove corleon-dev
```

CLI sandboxes are developer-operated. The application API intentionally exposes a narrower, policy-enforced execution surface.

## Rollout checklist

1. Confirm the Vercel project is linked to the intended team and deployment environment.
2. Provision/verify PostgreSQL backups and apply the migration.
3. Add `CORLEON_SANDBOX_API_KEY` and `CORLEON_SANDBOX_TENANT_ID` to the intended Vercel environment only.
4. Verify Vercel OIDC Sandbox authentication from a Preview deployment.
5. Run a harmless Node.js and Python smoke test.
6. Confirm deny-all network policy, tenant isolation, idempotency, output caps, and audit records.
7. Keep production deployment and production data writes behind a separate approval.
