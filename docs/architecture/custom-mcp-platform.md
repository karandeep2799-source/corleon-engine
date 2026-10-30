# Corleon Engine — Governed MCP Platform

**Status:** Architecture baseline  
**Source:** OpenAI Custom MCP Server guide, reviewed 2026-10-30  
**Official reference:** https://developers.openai.com/api/docs/guides/custom-mcp-server

## 1. Purpose

MCP is Corleon's standard integration protocol for exposing external systems and internal capabilities as typed tools. MCP is the connectivity layer, not the agent brain, policy engine, workflow engine, or system of record.

The platform must support OpenAI, Claude, Gemini, and future model providers through a model-independent tool contract. Provider-specific adapters may translate tool schemas and execution events, but authorization and business rules remain in Corleon.

## 2. Logical architecture

```text
Web / API / Chat / IDE clients
          |
          v
Identity + Tenant Context
          |
          v
Agent Runtime / Planner
          |
          +---- Model Router (OpenAI / Anthropic / Google / others)
          |
          v
Tool Discovery + Registry
          |
          v
Policy Decision Point ---- Approval Service
          |                       |
          +-----------+-----------+
                      |
                MCP Gateway
                      |
          +-----------+-----------+
          |           |           |
       GitHub       Vercel      Business
       MCP          MCP         MCP
          |           |           |
       External systems and internal services
                      |
          Execution receipts + audit events
                      |
          PostgreSQL / Prisma + telemetry
```

## 3. Service boundaries

- **Agent runtime:** plans work, selects models, requests tools, tracks conversation/task state, and delegates specialist work.
- **Model router:** provider adapters, model capability metadata, budgets, fallbacks, and provider health.
- **Tool registry:** canonical tool IDs, versions, schemas, descriptions, server instructions, capability tags, owner, health, and deprecation state.
- **MCP gateway:** transport termination, authentication context, schema validation, rate limiting, tool dispatch, and response normalization.
- **Policy engine:** evaluates actor, tenant, tool, resource, risk, environment, data classification, and requested operation.
- **Approval service:** creates immutable approval requests bound to a specific action digest, target resource, arguments, expiry, and approver.
- **Execution engine:** idempotency, bounded retries, timeout, cancellation, concurrency limits, and execution receipts.
- **Audit service:** append-only records for discovery, policy decisions, approvals, execution, failures, and administrative changes.
- **Knowledge service:** source ingestion, provenance, versioning, extraction, review, and retrieval.

## 4. MCP interoperability

The OpenAI custom MCP guide documents connecting trusted custom servers, tool discovery/refresh, server-wide instructions, OAuth and supported unauthenticated configurations, SSE and streaming HTTP transports, and confirmation controls for write actions. ChatGPT custom plugin setup is documented through the web experience and remains subject to workspace permissions.

Corleon must not assume that a server being reachable means it is authorized. Each client connection gets its own identity, tenant, scopes, and policy evaluation. Never treat a model-generated tool call as proof of user permission.

Do not require every MCP server to expose search/fetch tools. Expose purpose-built tools with action-oriented names and precise schemas. Use server instructions for safe sequencing and shared constraints; keep tool descriptions independently useful.

## 5. Tool metadata contract

Each registered tool must include:

| Field | Requirement |
|---|---|
| `toolId` | Stable namespaced ID, e.g. `github.pull_request.create` |
| `version` | Semver contract version |
| `description` | Action-oriented purpose and when to use |
| `inputSchema` | Strict JSON Schema with bounds and enums |
| `outputSchema` | Stable normalized result |
| `accessMode` | READ, WRITE, DELETE, ADMIN |
| `riskTier` | LOW, MEDIUM, HIGH, CRITICAL |
| `scopes` | Explicit permission requirements |
| `approvalPolicy` | NEVER, ON_RISK, ALWAYS |
| `idempotency` | Required for retryable mutations |
| `timeoutMs` | Bounded execution timeout |
| `dataClassifications` | Public, internal, confidential, restricted |
| `owner` | Service/team responsible for the tool |

Descriptions should state when to use a tool, what it changes, required preconditions, and important edge cases. Avoid vague tools such as `do_action` or `manage_data`.

## 6. Security and authorization

1. Authenticate every client and resolve a server-verified user and tenant context.
2. Authorize each tool call against tenant membership, resource ownership, scopes, environment, and policy.
3. Use least-privilege OAuth scopes and short-lived credentials. Store refresh tokens and private keys only in a managed secret store.
4. Separate read and mutation tools. Default to deny when metadata or policy is missing.
5. Treat external tool output as untrusted. Sanitize content before it enters prompts, HTML, shell commands, SQL, or downstream tools.
6. Defend against prompt injection with instruction hierarchy, data isolation, allowlisted destinations, and policy checks outside the model.
7. Do not expose secrets or internal policy details in tool outputs or logs.
8. Use tenant-scoped rate limits, quotas, and concurrency limits.
9. Bind approvals to the exact canonical action digest; any argument or target change invalidates the approval.
10. Require stronger approval for delete, money movement, production deployment, permission changes, and bulk export.

Unauthenticated MCP is allowed only for intentionally public, non-sensitive capabilities. It is not an acceptable default for private Corleon data or mutations.

## 7. Execution lifecycle

```text
DISCOVER -> VALIDATE -> AUTHENTICATE -> AUTHORIZE
   -> RISK ASSESS -> [APPROVAL] -> EXECUTE
   -> VERIFY -> AUDIT -> RETURN RECEIPT
```

- Reject unknown tools, invalid schemas, expired credentials, and missing scopes.
- Use a stable idempotency key for each logical mutation.
- Retry only transient failures and only when the operation is safe to retry.
- Never blindly retry a non-idempotent external mutation.
- Record external request IDs and execution outcomes.
- Return a structured receipt with status, resource reference, timestamps, and trace ID.
- For long-running work, persist state and use a durable workflow/queue rather than holding an HTTP request open.

## 8. Suggested persistence model

Implement as Prisma models in a dedicated migration after reconciling with the repository's existing schema:

- `McpServer`: server identity, endpoint, transport, status, owner, trust level, configuration reference.
- `McpServerVersion`: server metadata and instruction/schema snapshots.
- `McpTool`: canonical tool ID, version, schemas, access mode, risk, scopes, approval policy.
- `McpConnection`: user/tenant connection, auth provider reference, granted scopes, expiry, status. Never store raw secrets here.
- `ToolExecution`: actor, tenant, tool/version, resource, idempotency key, argument digest, status, timing, external request ID, trace ID.
- `ApprovalRequest`: action digest, requester, approver, expiry, decision, reason, status.
- `AuditEvent`: append-only security and execution events with redacted metadata.
- `KnowledgeSource`: canonical URL or repository locator, title, owner, source type, trust, content hash, observed version, ingestion status.
- `KnowledgeArtifact`: extracted facts, architecture decisions, implementation candidates, evidence references, review state, links to source.

Use tenant-aware unique constraints and indexes. Apply retention and deletion policies by data class and legal requirement. Keep secrets in a secret manager, not in these tables.

## 9. Deployment topology

- **Next.js 16 on Vercel:** user interface, authenticated application APIs, lightweight request routing.
- **MCP gateway:** independently deployable Node.js service where persistent connections, transport requirements, or request duration justify it. Verify current platform support before selecting a runtime.
- **Cloud Run worker service:** long-running jobs, repository analysis, ingestion, code execution orchestration, and queue consumers.
- **PostgreSQL + Prisma:** canonical state and audit metadata.
- **Redis/queue:** short-lived coordination, rate limits, and job dispatch; PostgreSQL remains the durable record.
- **Object storage:** large source snapshots and artifacts, encrypted with lifecycle policies.
- **OpenTelemetry:** traces across model call, policy, MCP tool, and external API.

Use Vercel Functions for ordinary request/response endpoints, and durable workflows/queues or container workers for long-running tasks. Do not assume an SSE or streaming HTTP connection is equivalent to a durable background job.

## 10. Reliability and observability

Capture trace ID, tenant ID, actor ID, tool ID/version, policy decision, approval ID, idempotency key hash, duration, retry count, outcome, and external request ID. Redact secrets and minimize personal data.

Define service-level indicators for tool discovery latency, execution success, approval latency, timeout rate, provider error rate, and queue age. Alert on anomalous write volume, repeated authorization failures, and unexpected tool/schema changes.

## 11. Testing and release gates

- Unit: policy decisions, risk classification, approval digest, idempotency, schema validation.
- Contract: MCP initialize/list/call flows and tool schema compatibility.
- Integration: OAuth lifecycle, tenant isolation, database transactions, external API mocks.
- Security: prompt injection fixtures, SSRF/egress restrictions, token leakage, replay, confused-deputy, cross-tenant access.
- Resilience: timeout, cancellation, duplicate delivery, retry exhaustion, partial failure.
- E2E: client -> agent -> policy -> approval -> MCP -> external sandbox -> audit receipt.

A tool is not production-ready until its permissions, schemas, approval behavior, tests, owner, runbook, and rollback/deprecation path are documented.

## 12. Phased implementation

1. **Foundation:** registry, gateway skeleton, identity context, schema validation, read-only tools, audit event contract.
2. **Governance:** policy engine, tenant scopes, approval requests, immutable action digests.
3. **Execution:** idempotency, queues/workflows, retry and timeout policy, receipts.
4. **Connectors:** GitHub and Vercel first, then Notion, Airtable, Cloudflare, Shopify, payment systems.
5. **Intelligence:** model-independent tool planner, retrieval-based discovery, model routing and evaluations.
6. **Operations:** dashboards, alerts, security exercises, disaster recovery, cost controls.

## 13. Source notes and limitations

This architecture records the design implications of the OpenAI guide; it does not claim that a Corleon MCP server has been deployed, authenticated, or connected to a ChatGPT account. Validate exact SDK APIs, transport support, OAuth registration options, and hosting limits against current vendor documentation at implementation time.

Primary source: https://developers.openai.com/api/docs/guides/custom-mcp-server
