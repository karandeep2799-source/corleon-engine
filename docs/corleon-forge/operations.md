# Corleon Forge operations and incident controls

## Default-off rollout

The factory must remain disabled until its runtime adapters, authentication, authorization, tests, and deployment settings have been implemented and reviewed. The example environment file is a contract, not evidence that the runtime currently consumes these variables.

## Kill switch

Implement a server-side feature flag checked before accepting work and again before every mutating step. Turning the flag off must stop new runs and prevent branch writes/PR creation; active sandboxes should be cancelled or allowed only to reach a safe cleanup boundary. The kill switch must not depend on the model provider.

## Resource limits

Configure and enforce:
- maximum run duration and per-step timeout;
- maximum concurrent runs per repository and tenant;
- bounded output and log sizes;
- maximum retry count;
- model/token/spend budget where provider usage is available;
- sandbox CPU, memory, disk, and network policy.

## Webhook security

Verify the provider signature against the raw request body before parsing. Reject invalid signatures, stale timestamps where supported, oversized payloads, and unsupported event types. Persist a unique delivery ID before enqueueing. Do not trust a repository name or actor supplied in an unsigned payload.

## Prompt injection and untrusted code

Repository content, issue text, comments, package scripts, test output, and dependency metadata may contain hostile instructions. They are data, not policy. System policy and server-side authorization must be enforced outside the model. Do not provide production credentials to a sandbox. Avoid privileged network egress and deny metadata endpoints.

## Incident response

For suspected secret exposure, unauthorized write, runaway cost, or malicious execution:
1. Disable intake using the server-side kill switch.
2. Cancel active runs and revoke short-lived credentials.
3. Preserve redacted audit records and relevant check logs.
4. Inspect factory-owned branches and draft PRs; close or revert unsafe changes.
5. Rotate any potentially exposed credentials.
6. Re-enable only after a documented root-cause review and regression test.

## Release gates

Do not enable production execution until CI includes tests for signature verification, duplicate delivery, access control, state transitions, retry ceilings, cancellation, log redaction, sandbox command policy, and branch ownership. Run the first pilot against a disposable test repository.
