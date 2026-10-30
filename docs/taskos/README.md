# Corleon TaskOS

TaskOS is a tenant-scoped task and agent subsystem inside Corleon Engine. PostgreSQL is authoritative for Corleon task state. Google Tasks is inbound-only: TaskOS imports Google tasks but never creates, edits, reorders, or deletes Google tasks.

## Implemented in this branch
- Prisma schema and initial PostgreSQL migration.
- Task CRUD API, tenant-scoped service-token guard and audit events.
- Agent registry with intake, planner, priority and reporter logic.
- Durable PostgreSQL job queue using row locks / SKIP LOCKED, bounded retries and dead-letter status.
- Google Tasks read/import adapter and scheduled sync worker.
- Stripe subscription Checkout endpoint, allowlisted Price IDs, signed webhook verification and event deduplication.
- Vercel cron entries and environment template.

## Setup
1. Configure PostgreSQL and install dependencies from the repository root.
2. Set TaskOS, Google OAuth and Stripe variables from the root environment template.
3. Run `pnpm --filter @corleon/web db:generate`, then `pnpm --filter @corleon/web db:migrate`.
4. Configure Google OAuth credentials and the exact callback URL before enabling the Google connection flow.
5. Configure Stripe webhook events `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.
6. Set Vercel environment variables for production, preview and development separately.

## API
Private TaskOS endpoints require `Authorization: Bearer $TASKOS_API_TOKEN`. This first adapter is single-tenant/single-user. Replace it with Corleon's verified session/JWT principal adapter before multi-user rollout; never trust tenant IDs from request bodies.

- `GET/POST /api/taskos/tasks`
- `PATCH/DELETE /api/taskos/tasks/:taskId`
- `POST /api/taskos/agents`
- `POST /api/taskos/jobs`
- `POST /api/integrations/google-tasks/sync` (requires an established connection)
- `GET /api/cron/taskos-sync`
- `GET /api/cron/taskos-worker`
- `POST /api/integrations/stripe/checkout` (subscription)
- `POST /api/integrations/stripe/payments/checkout` (one-time payment)
- `POST /api/integrations/stripe/portal` (customer billing portal)
- `POST /api/integrations/stripe/webhook`

## Explicit release blockers
Google OAuth connect/callback route files could not be added in this execution, so credential authorization and connection onboarding are not yet complete. The existing sync adapter assumes a valid encrypted GoogleTasksConnection row. Do not represent Google Tasks as connected until the OAuth authorization-code flow, state/PKCE validation, refresh-token persistence and revocation path have been implemented and tested.

The repository does not yet expose a verified end-user auth adapter. The service-token principal is for controlled integration testing only; replace it with the Corleon identity provider before multi-user production. Do not expose the service token to browser JavaScript.

## Agents
Intake, planner, priority and reporter have deterministic database-backed behavior. Research, GitHub and QA are adapter slots; they do not execute external tools until provider adapters, scoped permissions, sandboxing and approvals are configured. High autonomy is limited to safe internal operations.

## Google synchronization
Sync is one-way and idempotent on `(tenantId, source, externalId)`. The importer stores external identifiers and source list metadata. This initial bounded full scan does not yet persist incremental sync tokens or paginate beyond the first 100 results; implement pagination and deletion reconciliation before large-account rollout.

## Durable worker
The worker claims rows using PostgreSQL `FOR UPDATE SKIP LOCKED`, applies bounded exponential backoff and marks exhausted jobs DEAD. Configure alerting for dead jobs and stale RUNNING leases; add a lease-reaper before multi-instance high-volume operation.

## Stripe billing
Subscription Checkout and one-time Payment Checkout accept separate allowlisted Stripe Price IDs and same-origin redirect URLs. The Billing Portal is tenant-scoped. Webhooks verify signatures using the raw request body and deduplicate event IDs; the payment ledger records checkout completion, PaymentIntent success/failure and refunds. Never treat the success redirect as proof of payment; entitlements must depend on webhook-backed subscription state. Add invoice-level reconciliation, tax configuration and a dedicated billing event outbox before financial automation.

## Security / operations
Keep encryption keys, API tokens, Stripe secrets and Google OAuth secrets in Vercel encrypted environment variables or a secret manager. Rotate encryption keys through a re-encryption migration. Enforce HTTPS, rate limits, restrictive origins, backups and restore tests. External agent writes, shell access and deployment actions remain disabled until isolated execution and explicit authorization policies are installed.

## Validation status
GitHub files and migration have been committed to this feature branch. No package installation, Prisma validation/generation, automated test run, Next.js production build, Stripe test-mode checkout, Google OAuth round-trip or Vercel deployment has been executed in this environment. Treat this as an implementation branch requiring CI and the release blockers above, not a completed production launch.
