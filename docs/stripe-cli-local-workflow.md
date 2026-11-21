# Stripe CLI — local development

Corleon Engine uses the official Stripe CLI to forward **test-mode** webhook events to the Next.js webhook route. This keeps the Stripe CLI outside the production runtime and avoids adding a platform-specific binary to the pnpm dependency graph.

## Upstream change tracked

[Stripe CLI PR #2207](https://github.com/stripe/stripe-cli/pull/2207) was merged as `81a9410bccb7c3fab4b46e48dc357b6e2cb17a91`.

The PR fixes plugin-management invocation telemetry in the Stripe CLI: it stamps the validated plugin target before asynchronous telemetry starts and snapshots invocation metadata so later command execution cannot mutate the event. It changes Stripe CLI Go internals; it is not an application SDK/API change and its Go files do not belong in this TypeScript/Next.js repository. Use an up-to-date official Stripe CLI installation to receive upstream fixes.

## Prerequisites

- Node.js 24 and pnpm 12.4.0 (the repository's pinned toolchain).
- The official Stripe CLI installed and authenticated with `stripe login`.
- Corleon Engine dependencies installed with `pnpm install --frozen-lockfile`.
- Local test credentials in an untracked `.env` file.

Check the CLI is available:

```bash
stripe --version
pnpm stripe:version
```

## Start the application and forward webhooks

Terminal 1:

```bash
pnpm dev
```

Terminal 2:

```bash
pnpm stripe:listen
```

The CLI prints a temporary webhook signing secret beginning with `whsec_`. Copy that value into the local `.env` as `STRIPE_WEBHOOK_SECRET`, then restart the Next.js process if it was already running.

The listener forwards events to:

```text
http://localhost:3000/api/webhooks/stripe
```

If the web app runs on a different port, invoke the CLI directly with the matching URL:

```bash
stripe listen --forward-to localhost:PORT/api/webhooks/stripe
```

## Important event-processing behavior

The webhook endpoint verifies the raw request body and `stripe-signature` using `STRIPE_WEBHOOK_SECRET`. Supported events are:

- `payment_intent.succeeded`
- `invoice.paid`
- `charge.refunded`
- `charge.dispute.created`

Supported events require a valid Corleon `organizationId` in Stripe object metadata (or a recoverable linked order for refunds/disputes). Generic Stripe CLI fixtures may not contain that application metadata and can correctly receive HTTP 400. An HTTP 400 from such a fixture is not evidence that signature forwarding is broken.

## Safety

- Use Stripe test-mode keys and test data only during local development.
- Keep `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in local environment files or the approved secret manager; never commit populated values.
- Treat the signing secret printed by `stripe listen` as a secret. Rotate it if exposed.
- Do not use this listener to expose a production webhook endpoint or enable live payment processing.
- This workflow does not deploy, change Vercel settings, create products/prices, or initiate payments.
