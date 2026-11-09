# Corleon Agent Runtime

Provider-neutral agent execution control plane. DigitalOcean Harness Runtime is the first provider adapter. The provider contract isolates execution, event streaming and HITL decisions so additional providers can be added without changing the job and approval APIs.

## Safety defaults
- Provisioning is disabled unless `CORLEON_AGENT_RUNTIME_ENABLED=true`.
- Every management endpoint requires `Authorization: Bearer $CORLEON_AGENT_RUNTIME_API_TOKEN`; use a random secret of at least 32 characters.
- Provider and model credentials remain server-side secrets.
- Harness tool policy defaults to `ask`; bash is approval-required and filesystem writes are workspace-scoped.
- Network egress is allowlisted.
- Agent instructions explicitly prohibit deployment, publishing, spending money, production-data changes and secret disclosure.
- The event stream records HITL requests as durable approval records. Approval decisions are sent to the DigitalOcean session's native HITL endpoint before the local record is finalized.
- No production deployment, payment, financial execution or destructive automation is enabled.

## Environment
See `.env.example`. Provisioning requires a DigitalOcean API token and a model credential for the selected adapter. Keep `CORLEON_AGENT_RUNTIME_ENABLED=false` until account permissions, region availability, egress, session limits and spend controls have been reviewed.

## API (all routes require the runtime bearer token)
- `GET /api/agent-runtime`: job, session and approval counts.
- `POST /api/agent-runtime`: create durable job. Body: `organizationId`, `prompt`, optional `adapter` (`CODEX`, `CLAUDE_CODE`, `OPENCODE`), `repository` (`OWNER/REPO`), `branch`, `requestedBy`. Supply `Idempotency-Key` for safe retries.
- `POST /api/agent-runtime/jobs/:jobId/provision`: allocate a remote session. Returns 202 while the sandbox boots. Requires feature flag.
- `POST /api/agent-runtime/jobs/:jobId/start`: check remote readiness and deliver the saved job prompt only when the session reports a ready or running state.
- `POST /api/agent-runtime/sessions/:sessionId/input`: send task input.
- `POST /api/agent-runtime/sessions/:sessionId/actions`: `pause`, `resume`, `cancel`, `remove`.
- `GET /api/agent-runtime/sessions/:sessionId/events`: authenticated SSE proxy. Supports `cursor`, `replay_only=true` and `replay_from`; persists HITL requests and run terminal states while streaming.
- `PATCH /api/agent-runtime/approvals/:approvalId`: resolve a pending HITL request as `APPROVED` or `DENIED`. The decision is forwarded to DigitalOcean before the local approval is marked resolved.

## Release
1. Configure secrets in the deployment secret manager.
2. Apply additive Prisma migration: `pnpm prisma:deploy`.
3. Generate Prisma Client: `pnpm prisma:generate`.
4. Verify the protected status endpoint and exercise create/provision/events/approval flows using a non-production DigitalOcean team.
5. Keep provisioning disabled until credentials, region, egress, account limits and spend limits are reviewed.

## Remaining release gates
- Vercel Sandbox is not yet an implemented provider. Its SDK and execution lifecycle need a separately validated adapter; do not select `vercel-sandbox`.
- Checkpoint listing/creation, fork and rollback APIs are not yet wired into Corleon's persistence model.
- Remote-state reconciliation after disconnects and event-cursor persistence across client reconnects need a durable worker.
- Action Gateway approvals are separate from Harness Runtime HITL and are not implemented here.
- Add integration tests against a disposable DigitalOcean team before enabling provisioning.
