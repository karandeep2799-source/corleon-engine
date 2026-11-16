# Corleon Engine — Atlassian Cloud Enterprise Workflow Pack

**Status:** Prepared on a feature branch; design-only; no Atlassian tenant configured.  
**Target:** Jira, Jira Service Management, Confluence, Atlassian Administration, Rovo and approved integrations.  
**Repository baseline:** pnpm/Turborepo monorepo; Next.js app in `apps/web`; existing architecture preserved.

## 1. Executive design

This pack defines enterprise workflow blueprints and safe operating procedures for Corleon Engine. Atlassian is the work-management and knowledge collaboration surface; Corleon remains the policy decision point, integration gateway, durable execution system and canonical audit/approval service for Corleon-controlled actions.

The definitions in `config/atlassian/` are Corleon-owned declarative specifications. They are **not** claimed to be directly importable Atlassian workflow or Automation exports. Atlassian's native workflow and automation formats must be generated or configured through the tenant's supported UI/API after its site, product entitlements, project keys, custom fields, groups and administrator permissions have been verified.

## 2. Scope

Nine enterprise workflows are specified:

| ID | Workflow | Primary Atlassian surface | Risk |
|---|---|---|---|
| ENT-GOV | Enterprise governance and policy change | Jira | High |
| ENT-IAM | Identity and access lifecycle | Jira Service Management | Critical |
| ENT-AI | AI agent onboarding and governance | Jira | Critical |
| ENT-SDLC | Software delivery and code review | Jira + GitHub | High |
| ENT-CHG | Production change and release control | Jira Service Management | Critical |
| ENT-INC | Security and service incident response | Jira Service Management | Critical |
| ENT-KNOW | Enterprise knowledge and policy publishing | Confluence | Medium |
| ENT-VENDOR | Marketplace app and vendor intake | Jira | High |
| ENT-DATA | Data access, export and retention exception | Jira Service Management | Critical |

Each workflow defines states, allowed transitions, risk tier and transition gates. The configuration is intentionally conservative: approvals, security evidence and explicit release authorization are required for high-impact changes.

## 3. System responsibilities

- **Atlassian Jira/JSM:** work items, queues, workflow state, assignment, service requests, human-facing approvals where supported by the tenant's product plan.
- **Confluence:** controlled knowledge, policies, runbooks, architecture decisions and review dates.
- **Rovo:** optional AI-assisted discovery and summarization, subject to an explicit data-access policy. Rovo output is advisory, not an approval or authorization decision.
- **Corleon policy engine:** tenant/resource authorization, risk classification, scope enforcement, action digest and approval validity.
- **Corleon approval service:** immutable action-bound approvals; requester/approver separation; expiry; evidence; decision record.
- **Corleon execution service:** idempotency, retries, execution receipts, external API calls and rollback orchestration.
- **GitHub:** source control, pull requests and CI evidence.
- **Vercel:** deployment status and preview/production metadata. Production deploy actions remain disabled until separately authorized.
- **PostgreSQL/Prisma:** canonical Corleon state and audit references. Atlassian is not the sole audit ledger for Corleon actions.

## 4. Governance and safety requirements

1. Deny by default if actor, tenant, resource, scope, policy or risk metadata is missing.
2. Read-only access is the initial integration mode. Mutations require an explicit allowlisted operation.
3. Critical and production actions require a human approval bound to a canonical action digest, target, arguments and expiry.
4. Requesters cannot approve their own requests. At least two distinct approvers are required for production changes and selected high-risk governance actions.
5. An approval expires when its action arguments, target resource, deployment artifact or risk classification changes.
6. No workflow automation may deploy, publish, revoke access, alter org settings, change billing, delete data or create privileged credentials.
7. Use dedicated service accounts and least-privilege OAuth scopes. Never place API tokens in Jira descriptions, Confluence pages, issue attachments, repository files or logs.
8. Store credentials in an approved secret manager; use references/connection IDs in configuration. Rotate and revoke credentials through an approved operational process.
9. Redact secrets and minimize personal data in logs and issue fields.
10. Keep an append-only audit trail for requests, policy decisions, approval, execution, failure, verification and rollback.

## 5. Atlassian tenant prerequisites — verify, do not assume

Before configuring a tenant, an authorized Atlassian organization administrator must confirm:

- Atlassian Cloud organization and site URL(s), organization ID and product instances.
- Actual subscription tier and entitlement for Jira, Jira Service Management, Confluence, Rovo and any Guard capabilities. The marketing page alone does not establish an active Enterprise subscription.
- User directories, verified domains, identity provider, SSO/SCIM posture and managed-account policy.
- Project keys, issue types, custom fields, screens, permission schemes, workflow schemes and service request types.
- Groups/roles for governance owner, security reviewer, auditor, approver, operator and incident commander.
- Automation limits/quotas and whether cross-product or external integration actions are permitted.
- Data residency, classification, retention, legal hold and applicable privacy requirements.
- Sandbox and release-track availability; use sandbox for validation before production rollout.
- Existing workflows and automation rules to avoid overwriting or duplicating them.

Do not create users, groups, projects, custom fields, OAuth apps, API tokens, app subscriptions or organization settings as part of this preparation.

## 6. Implementation sequence

### Phase A — Discovery (read-only)
1. Confirm tenant identity, products, plans, sites and sandbox.
2. Export/list existing workflows, schemes, automation rules, groups, permissions and custom fields.
3. Map existing objects to the nine workflow IDs; identify conflicts and migration risks.
4. Confirm API capabilities and OAuth scopes for each operation.
5. Record baseline audit log and current configuration snapshots.

### Phase B — Sandbox configuration
1. Create or adapt issue types and fields only after an approved change plan.
2. Configure workflows and transition validators/conditions/post-functions in sandbox.
3. Add automation rules from `automation-blueprints.json` manually or through a validated tenant-supported API.
4. Test each state transition, role restriction, approval, expiry, denial and notification.
5. Test duplicate events, retries, API failure and rollback behavior.
6. Capture screenshots/exported configuration and test evidence.

### Phase C — Production change request
1. Submit a production change record with sandbox evidence, risk assessment, owners and rollback plan.
2. Obtain explicit change approval from the designated administrators and security reviewers.
3. Schedule a maintenance/release window.
4. Apply configuration using the approved method and least-privilege account.
5. Verify live behavior and audit events; retain before/after snapshots.
6. Stop and roll back if permissions, approval checks, event delivery or workflow behavior differ from the approved plan.

### Phase D — Corleon integration
1. Register a dedicated Atlassian OAuth 2.0 (3LO) or supported app integration; prefer scoped, short-lived credentials.
2. Begin with read-only discovery and issue/knowledge retrieval.
3. Validate tenant identity and map Atlassian account identity to Corleon user/tenant identity.
4. Add write operations individually behind policy checks and approval gates.
5. Record Atlassian issue/page IDs, Corleon trace IDs and external request IDs in execution receipts.
6. Reconcile webhooks/events with periodic read-only polling; deduplicate by event ID and resource version.
7. Keep production release, org administration, user provisioning and permission mutations disabled until separately approved.

## 7. Workflow configuration mapping

Use `enterprise-workflows.json` as the source of truth for workflow IDs, statuses, transitions and gates. For each workflow:
- Map `states` to Jira workflow statuses.
- Map `transitions` to explicit workflow transitions.
- Implement `required_fields` as validators or transition screens.
- Implement `approval` as native JSM approval steps where available, or as a Corleon approval request linked to the issue. Do not emulate approval with a status field alone.
- Implement `security_checks`, `evaluation_threshold` and `evidence` as verified checks from trusted systems; never trust user-entered “passed” text as evidence.
- Implement `manual_release_gate` as a human-controlled action requiring a fresh approval token. Do not wire it to a deployment action in this phase.
- Implement `scheduled_review` through scheduled automation with a deduplication key.

## 8. Automation blueprint guidance

`automation-blueprints.json` contains eight proposed rules. They are implementation specifications, not native import files. Recreate each rule in Atlassian Automation after verifying:
- Rule owner and execution actor.
- Project/space scope and permissions.
- Trigger, conditions, branches, actions and audit comment.
- Loop prevention and duplicate event handling.
- Failure notification and rule usage limits.
- No hidden production action or broad admin scope.

All rules remain disabled until sandbox testing and explicit production authorization.

## 9. Security and audit evidence

For every workflow execution, retain:
- Corleon request ID and trace ID.
- Atlassian issue/page ID and workflow ID/version.
- Actor and tenant identifiers (non-secret).
- Before/after state, timestamp and rule ID.
- Policy decision and reason code.
- Approval ID, approver identity, action digest and expiry.
- External API request ID, outcome and retry count.
- Evidence references, verification result and rollback reference.

Never log bearer tokens, OAuth refresh tokens, authorization headers, private keys or unredacted secrets. Atlassian audit log retention and available event categories depend on subscription and product. Confirm actual retention with the tenant administrator and export required records to the Corleon audit store where permitted.

## 10. Rollback

- Disable only the newly introduced automation rules first.
- Restore the prior workflow scheme/configuration snapshot using the approved Atlassian administrative process.
- Revoke the dedicated integration grant if compromise or unexpected writes are suspected.
- Do not delete issues, pages, users, groups or historical audit events during rollback.
- Preserve evidence and record the rollback as a new audit event.
- Reconcile partially executed external actions manually; do not assume disabling a rule reverses completed actions.

## 11. Acceptance criteria

- All nine workflow definitions pass `node scripts/validate-atlassian-workflows.mjs`.
- Every workflow has an owner, risk tier, valid transitions and at least one appropriate control gate.
- Critical workflows require separation-of-duties approvals.
- Production change cannot proceed without explicit release authorization and rollback evidence.
- No secrets or populated credentials exist in the configuration.
- Automation blueprints are disabled and no Atlassian production settings have been changed.
- Sandbox tests demonstrate allow, deny, approval expiry, duplicate-event handling and rollback.
- Audit evidence is correlated across Atlassian and Corleon.
- Repository CI/build checks are run after integration; no deployment is triggered by this pack.

## 12. Official references

- [Atlassian Cloud Enterprise](https://www.atlassian.com/enterprise/cloud/cloud-enterprise)
- [Get started with your Enterprise plan](https://support.atlassian.com/organization-administration/docs/get-started-with-your-enterprise-plan/)
- [Organization audit log activities](https://support.atlassian.com/security-and-access-policies/docs/accessing-audit-log-activities/)
- [Manage Rovo access for Enterprise](https://support.atlassian.com/organization-administration/docs/manage-rovo-access-for-enterprise/)
- [Jira automation actions](https://support.atlassian.com/cloud-automation/docs/jira-automation-actions/)
- [Atlassian Cloud licensing](https://www.atlassian.com/licensing/cloud)

**Important:** Atlassian Enterprise capabilities are entitlement- and rollout-dependent. Validate the current tenant's plan, available APIs and admin experience before implementation. No tenant has been connected or modified by this repository pack.
