# Corleon Forge — AI Engineering Factory

Corleon Forge is Corleon Engine's repository-aware software engineering subsystem. It adapts the public eve Software Factory pattern to this repository; it is not a fork or a claim of compatibility with eve's internal APIs.

## Mission

Turn a well-scoped engineering task into a reviewed draft pull request while keeping humans responsible for merge and production release decisions.

## Lifecycle

1. **Intake / classify** — validate the task, identify risk and missing acceptance criteria. Ask for clarification instead of guessing.
2. **Analyze / plan** — inspect the target repository and write a plan, affected-file list, test plan, and explicit acceptance criteria.
3. **Implement in isolation** — create a factory-owned branch and use an isolated, short-lived execution environment. Never run untrusted task text as shell commands.
4. **Verify** — run repository-defined checks (tests, lint, typecheck, build, dependency/security checks where configured); capture exit codes and logs.
5. **Independent review** — a separate reviewer evaluates the actual diff and evidence against the plan. The reviewer must not rely on implementer self-reports.
6. **Draft PR** — publish the branch and open a draft PR containing summary, plan, tests, risks, and any skipped checks.
7. **Human decision** — a maintainer reviews and merges. Production deployment remains governed by existing deployment protections.

## Initial repository fit

The current repository contains Node.js modules and a Prisma schema, but does not currently expose a conventional Next.js app/package workspace. The factory foundation therefore starts as documented architecture and safe task contracts. Do not assume Next.js routes, an installed AI SDK, a workflow runtime, or sandbox SDK until those dependencies and app structure are verified.

## Recommended integration boundaries

- **Orchestration:** use a durable workflow runtime for multi-step runs, retries, cancellation, and resumption. Keep workflow steps idempotent.
- **Execution:** use Vercel Sandbox (or an equivalent isolated runtime) for repository checkout and commands; never execute repository code in the web request process.
- **AI:** route model calls through a provider abstraction / AI Gateway when configured. Validate structured model output at runtime and treat all model output as untrusted.
- **Persistence:** use PostgreSQL/Prisma for task, run, step, approval, and audit metadata after the schema is aligned with the existing schema. Do not create a second database client or duplicate existing identity models.
- **Source control:** GitHub App installation with least-privilege access to explicitly allowlisted repositories; write only factory-owned branches and draft PRs.
- **Observability:** persist correlation IDs, state transitions, durations, model/provider, token/cost metadata when available, check results, and redacted error details.

## Non-negotiable safety controls

- No direct pushes to the default branch, self-merge, or automatic production promotion.
- Require human approval for merge, deployment, secret changes, migrations with destructive impact, and high-risk operations.
- Use an explicit command allowlist; do not rely only on regex blocking.
- Enforce sandbox time, CPU/memory, output-size, concurrency, and spend limits.
- Do not expose application secrets to untrusted repository code. Use short-lived, scoped credentials only where unavoidable.
- Restrict outbound network access by default and deny cloud metadata endpoints.
- Treat issue bodies, repository files, dependency scripts, logs, and model responses as untrusted input (prompt-injection boundary).
- Redact secrets and personal data from logs. Never store raw credentials in task memory.
- Bound retries and require a new review after any code-changing repair.
- Record an append-only audit trail for authorization and state transitions.

## State machine

`queued -> classifying -> planned -> running -> verifying -> reviewing -> pr_open -> awaiting_human`

Terminal or recovery states: `needs_input`, `failed`, `cancelled`, `rejected`. A failed check may transition to `repairing` only within a bounded retry budget, then must re-enter `verifying` and `reviewing`.

Every transition must be validated server-side and written with an actor, timestamp, correlation ID, and reason.

## Delivery phases

### Phase 1 — safe foundation
- Define intake contract, state machine, security policy, and PR checklist.
- Keep the default branch untouched.
- Add tests for transition rules and authorization before enabling automation.

### Phase 2 — runtime
- Add a typed workflow orchestrator, isolated sandbox adapter, GitHub App adapter, and persistence models.
- Verify exact SDK versions against installed package documentation before implementing adapters.
- Add unit, integration, and sandbox smoke tests.

### Phase 3 — operations
- Add quotas, kill switch, queue visibility, structured telemetry, retention rules, and incident playbooks.
- Enable on a test repository first; then allowlist Corleon Engine.

## Definition of done

- [ ] Task schema validates required acceptance criteria and target repository.
- [ ] Authorization is checked at every mutation boundary.
- [ ] Sandbox uses ephemeral credentials and explicit command/network policies.
- [ ] Tests cover invalid transitions, duplicate webhook delivery, cancellation, retries, and unauthorized writes.
- [ ] Independent reviewer evaluates diff and verification evidence.
- [ ] PR is draft by default; merge and production deploy require human approval.
- [ ] CI, security checks, and a documented rollback/disable procedure pass.

## Naming

- Product: **Corleon Forge**
- Full description: **Corleon AI Engineering Factory**
- Orchestrator: **Forge Conductor**
- Specialist roles: **Triage**, **Architect**, **Builder**, **Verifier**, **Reviewer**
- Factory-owned branches: `corleon-forge/<task-id>-<slug>`
- Intake label: `corleon-forge`
