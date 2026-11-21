# Notion OS repository sync

The `Notion OS Sync` GitHub Actions workflow sends repository lifecycle events to a HTTPS webhook. The webhook must be a receiver you control (for example, a small integration service or automation endpoint) that validates the bearer token and performs the Notion API writes.

## Required GitHub Actions secrets

In the repository, open **Settings → Secrets and variables → Actions → New repository secret** and add:

- `NOTION_SYNC_WEBHOOK_URL`: HTTPS URL of your event receiver.
- `NOTION_SYNC_TOKEN`: bearer token expected by that receiver.

Do not commit these values, put them in workflow YAML, or paste them into issues, pull requests, or chat. Configure them directly in GitHub. GitHub encrypts repository secrets and exposes them to workflows only when explicitly referenced.

## Event payload

The workflow sends JSON with:

- `repository`: `owner/name`
- `event`: GitHub event name (for example `push`, `pull_request`, or `workflow_dispatch`)
- `ref`, `sha`, `actor`
- `run_id`, `run_url`

The receiver should validate the bearer token, validate the payload, use an idempotency key such as `repository + event + sha + run_id`, and return a 2xx response only after accepting the event. The workflow retries transient curl failures and fails on non-2xx responses.

## Pull request security

GitHub does not provide repository Actions secrets to workflows triggered by fork-originated pull requests. Those jobs are skipped by design. Same-repository pull requests and pushes require both secrets; missing configuration fails the job instead of reporting a misleading successful sync.

## Verify the integration

1. Add both secrets in GitHub repository settings.
2. Trigger the workflow with **Actions → Notion OS Sync → Run workflow**, or push a commit to `main`.
3. Confirm the job reports `Repository event delivered successfully`.
4. Confirm the receiver recorded the event and completed its Notion write.

The workflow only delivers events. It does not itself create or update Notion pages; that logic belongs in the configured receiver.
