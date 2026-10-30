# Corleon TaskOS

TaskOS is a tenant-scoped task and agent subsystem inside Corleon Engine. PostgreSQL is authoritative for Corleon task state. Google Tasks is inbound-only: TaskOS imports Google tasks but never creates, edits, reorders, or deletes Google tasks.

## Setup
1. Configure PostgreSQL and install dependencies from the repository root.
2. Set TaskOS, Google OAuth and Stripe variables from the root environment template.
3. Run `pnpm --filter @corleon/web exec prisma generate`, then apply a reviewed Prisma migration.
4. Register the exact Google callback URL `https://YOUR_HOST/api/integrations/google-tasks/callback` in Google Cloud Console.
5. Grant only Google Tasks readonly scope.
6. Configure Vercel cron for `/api/cron/taskos-sync` with `CRON_SECRET`.

## API
Private TaskOS endpoints require `Authorization: Bearer $TASKOS_API_TOKEN`. This first adapter is single-tenant/single-user. Replace it with Corleon's verified session/JWT principal adapter before multi-user rollout; never trust tenant IDs from request bodies.

- `GET/POST /api/taskos/tasks`
- `PATCH/DELETE /api/taskos/tasks/:taskId`
- `POST /api/taskos/agents`
- `GET /api/integrations/google-tasks/connect`
- `POST /api/integrations/google-tasks/sync`
- `POST /api/integrations/stripe/checkout`
- `POST /api/integrations/stripe/webhook`

## Agents
Intake, planner, priority and reporter have deterministic database-backed behavior. Research, GitHub and QA are adapter slots; they do not execute external tools until provider adapters, scoped permissions, sandboxing and approvals are configured. High autonomy is limited to safe internal operations.

## Google synchronization
Sync is one-way and idempotent on `(tenantId, source, externalId)`. The importer stores external identifiers and source list metadata. This initial bounded full scan does not yet persist incremental sync tokens or paginate beyond the first 100 results; implement pagination before large-account rollout.

## Stripe billing
Checkout accepts only allowlisted recurring Price IDs. Webhooks must verify signatures using the raw request body and deduplicate event IDs. Configure subscription created/updated/deleted events. Never treat the success redirect as proof of payment; entitlements must depend on webhook-backed subscription state. Add invoice/payment-intent reconciliation before financial automation.

## Security / operations
Keep encryption keys, API tokens, Stripe secrets and Google OAuth secrets in Vercel encrypted environment variables or a secret manager. Rotate encryption keys through a re-encryption migration. Enforce HTTPS, rate limits, restrictive origins, backups and restore tests. External agent writes, shell access and deployment actions remain disabled until isolated execution and explicit authorization policies are installed.

## Release gate
This branch is a production-oriented foundation, not a verified production rollout. Prisma migration generation, dependency installation, Stripe SDK compatibility, Google OAuth round-trip, and complete test/build matrix must pass in CI before release. Existing repository does not yet expose an established end-user auth adapter, so the service-token adapter must be replaced before multi-user production use.
