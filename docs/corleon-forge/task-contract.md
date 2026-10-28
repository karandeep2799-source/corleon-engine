# Corleon Forge task and review contracts

## Intake contract

A task is eligible only when it identifies:
- a goal and expected behavior;
- acceptance criteria that can be checked;
- the target repository and base branch;
- risk classification (low, medium, high);
- required checks or a reason why they cannot run.

If the task is ambiguous, destructive, security-sensitive, or asks to alter production infrastructure, transition to `needs_input` or require explicit approval before execution.

## Run record

Persist the following fields (names are conceptual until implemented in Prisma):
- `id`, `taskId`, `repositoryFullName`, `baseRef`, `branchName`;
- `status`, `attempt`, `createdAt`, `updatedAt`, `startedAt`, `finishedAt`;
- `correlationId`, `requestedBy`, `approvedBy`;
- `plan`, `acceptanceCriteria`, `riskLevel`;
- `checks[]` with command identifier, exit code, duration, and redacted log reference;
- `reviewVerdict`, `reviewFindings[]`, `pullRequestUrl`;
- `modelProvider`, `modelId`, and cost/token metadata only when supplied by the provider.

Never persist secrets, raw authorization headers, or unredacted environment dumps.

## Review contract

The reviewer receives the task, acceptance criteria, actual diff, and verification evidence. It returns:
- `verdict`: `approve`, `request_changes`, or `blocked`;
- findings with severity, file, line range where available, impact, and actionable remediation;
- evidence links to tests/checks;
- unresolved risks and skipped checks.

An `approve` verdict means only that the automated review found no blocking issue. It is not merge authorization.

## Idempotency and delivery

- Derive an idempotency key from the source event ID and repository.
- Persist the event receipt before scheduling work.
- Duplicate webhooks must return the original run result and must not start a second run.
- Use an outbox or equivalent transactional handoff between database state and queue dispatch.
- Retry only transient errors, with exponential backoff, jitter, and a hard attempt limit.
- Use compare-and-set/state-version checks to prevent concurrent workers from advancing a run twice.

## Authorization matrix

| Action | Factory agent | Maintainer |
| --- | --- | --- |
| Read allowlisted repository | Yes, scoped | Yes |
| Create/update factory-owned branch | Yes, scoped | Yes |
| Open draft PR | Yes, scoped | Yes |
| Change repository secrets/settings | No | Explicit authorized workflow |
| Push to default branch | No | Existing repository policy |
| Approve/merge PR | No | Yes |
| Promote production deployment | No | Yes |
| Execute arbitrary shell from task text | No | No |
