# Corleon Engine — Production Architecture

## Boundaries

- **API/control plane:** authentication, request validation, agent/run APIs, webhooks, health checks.
- **Agent runtime:** orchestration, model routing, tool execution, retries, cancellation and budgets.
- **Learning:** feedback, evaluations, memory and prompt/version lifecycle.
- **MCP:** server/tool registry, policy enforcement and execution audit.
- **Cashflow:** immutable financial records, idempotency, provider adapters and reconciliation.
- **Persistence:** PostgreSQL through Prisma.

## Reliability rules

1. Every externally retried mutation uses an idempotency key.
2. Webhooks are authenticated before processing and deduplicated before side effects.
3. Financial state changes are append-only/auditable; derived balances are rebuildable.
4. Agent execution has explicit timeout, retry and cost/token limits.
5. High-impact tools require explicit policy approval.
6. Logs never contain API keys, authorization headers, payment secrets or raw credentials.
7. Readiness must fail when critical persistence dependencies are unavailable.

## Deployment model

Run the HTTP API as a stateless service. Long-running agent work should execute in a worker/runtime process rather than depending on a single serverless request lifecycle. PostgreSQL remains the source of truth for durable state; queue infrastructure can be introduced independently.

## Next implementation phases

- typed API contracts and request validation
- durable agent run state machine
- model/provider registry and usage accounting
- MCP registry + authorization middleware
- immutable ledger/reconciliation hardening
- integration/evaluation test suite
- OpenTelemetry-compatible traces and metrics
- deployment and rollback automation
