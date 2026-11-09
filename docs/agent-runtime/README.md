# Corleon Agent Runtime

Provider-neutral agent execution control plane. DigitalOcean Harness Runtime is the first provider adapter. The provider contract is isolated so Vercel Sandbox can be added without changing job, approval or audit contracts.

## Safety defaults
- Provisioning is disabled unless `CORLEON_AGENT_RUNTIME_ENABLED=true`.
- Every management endpoint requires `Authorization: Bearer $CORLEON_AGENT_RUNTIME_API_TOKEN`; use a random secret of at least 32 characters.
- Provider and model credentials remain server-side secrets.
- Harness tool policy defaults to `ask`; bash is approval-required and filesystem writes are workspace-scoped.
- Network egress is allowlisted.
- No production deployment, payment, financial execution or destructive automation is enabled.
- Approval records are an audit/control surface, not a substitute for a remote adapter's enforcement callback.

## Environment
See `.env.example`. Provisioning requires a DigitalOcean API token and a model credential for the selected adapter.

## API (all routes require the runtime bearer token)
- `GET /api/agent-runtime`: job, session and approval counts.
- `POST /api/agent-runtime`: create durable job. Body: `organizationId`, `prompt`, optional `adapter` (`CODEX`, `CLAUDE_CODE`, `OPENCODE`), `repository` (`OWNER/REPO`), `branch`, `requestedBy`. Supply `Idempotency-Key` for safe retries.
- `POST /api/agent-runtime/jobs/:jobId/provision`: provision a remote session. Requires feature flag.
- `POST /api/agent-runtime/sessions/:sessionId/input`: send task input.
- `POST /api/agent-runtime/sessions/:sessionId/actions`: `pause`, `resume`, `cancel`, `remove`.
- `PATCH /api/agent-runtime/approvals/:approvalId`: record `APPROVED` or `DENIED`.

## Release
1. Configure secrets in the deployment secret manager.
2. Apply additive Prisma migration: `pnpm prisma:deploy`.
3. Generate Prisma Client: `pnpm prisma:generate`.
4. Verify the protected status endpoint.
5. Keep provisioning disabled until credentials, region, egress, account limits and spend limits are reviewed.

## Release boundary
The first release provisions sessions and records jobs, sessions, approvals and audit events. It does not yet implement the DigitalOcean SSE consumer, checkpoint/fork synchronization, Vercel Sandbox adapter, or Action Gateway approval callback. Keep privileged tools unavailable until those enforcement paths are implemented and tested.
