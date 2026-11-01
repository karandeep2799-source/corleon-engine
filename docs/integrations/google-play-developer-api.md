# Google Play Developer API integration

Corleon Engine uses server-only Next.js route handlers and the shared src/google-play service module.

## Capabilities

- Service-account OAuth 2.0 JWT bearer exchange and short-lived in-memory access-token caching.
- Product purchase verification and Subscription Purchases v2 lookup.
- Purchase-token SHA-256 hashing; raw purchase tokens are not persisted.
- RTDN Pub/Sub push handling with Google OIDC identity validation, package-name pinning and duplicate-message protection.
- Voided-purchase retrieval for refund and chargeback reconciliation.
- Production review retrieval and separately gated review replies.
- Crash-rate and ANR-rate Reporting API query pass-through.
- Read-only Play Console user/permission listing.
- Transactional publishing edit creation and commit endpoints behind two independent approval gates.

## Required configuration

Set these only in a server-side secret manager such as Vercel Project Settings → Environment Variables. Never commit populated values.

| Variable | Purpose |
| --- | --- |
| GOOGLE_PLAY_PACKAGE_NAME | Exact Android application ID; not yet supplied. |
| GOOGLE_PLAY_DEVELOPER_ACCOUNT_ID | Numeric developer account ID for the account-level users.list permissions endpoint. |
| GOOGLE_PLAY_SERVICE_ACCOUNT_JSON | Full service-account JSON as a single-line JSON secret. |
| GOOGLE_PLAY_ADMIN_TOKEN | High-entropy bearer token protecting administrative routes. |
| GOOGLE_PLAY_PUBSUB_AUDIENCE | Exact audience configured on the Pub/Sub push subscription. |
| GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT_EMAIL | Expected service-account email claim from Pub/Sub OIDC. |
| GOOGLE_PLAY_PUBLISHING_ENABLED | Must remain false until explicitly approved. |
| GOOGLE_PLAY_SUPPORT_WRITES_ENABLED | Must remain false until review-reply writes are approved. |
| GOOGLE_PLAY_WRITE_APPROVAL_TOKEN | Separate high-entropy token supplied in x-google-play-approval for each approved write. |
| GOOGLE_PLAY_PRODUCTION_PUBLISHING_ENABLED | Must remain false until a production release is explicitly approved. |
| GOOGLE_PLAY_PRODUCTION_APPROVAL_TOKEN | Independent token supplied in x-google-play-production-approval for production-track changes and commits. |

Grant the service account app-level access in Play Console and the required API permissions. Enable Android Publisher API and, for vitals, Google Play Developer Reporting API in the associated Cloud project. RTDN also requires a Pub/Sub topic/subscription configured in Play Console.

## Administrative routes

All routes require Authorization: Bearer GOOGLE_PLAY_ADMIN_TOKEN, except the Pub/Sub webhook which validates the Google-signed OIDC identity.

| Method | Route | Behavior |
| --- | --- | --- |
| GET | /api/google-play/status | Configuration and capability status |
| POST | /api/google-play/purchases/verify | Verify a product or subscription token |
| POST | /api/google-play/subscriptions/lookup | Refresh one subscription from Google (token in request body, never URL) |
| GET | /api/google-play/voided-purchases | Retrieve voided purchases |
| GET | /api/google-play/reviews | Retrieve production reviews with comments |
| POST | /api/google-play/reviews | Reply only with support-write enablement and approval |
| POST | /api/google-play/reporting/crash-rate | Query crash-rate metrics |
| POST | /api/google-play/reporting/anr-rate | Query ANR-rate metrics |
| GET | /api/google-play/permissions/users | List developer-account users and permissions (account-level API) |
| POST | /api/google-play/publishing/edits | Create an edit only with publishing enablement and approval |
| PUT | /api/google-play/publishing/edits/:editId/tracks/:track | Update a release track only with publishing approval |
| PUT | /api/google-play/publishing/edits/:editId/listings/:language | Update a localized listing only with publishing approval |
| POST | /api/google-play/publishing/edits/:editId/commit | Commit an edit with a track in the JSON body; production additionally requires the separate production gate |
| POST | /api/webhooks/google-play | RTDN Pub/Sub push endpoint |

## Purchase verification

Send kind=PRODUCT with productId and purchaseToken, or kind=SUBSCRIPTION with purchaseToken. The server verifies directly with Google before returning a verified result. A one-time product is verified only when Google reports purchaseState=0. A subscription is considered entitled only for SUBSCRIPTION_STATE_ACTIVE or SUBSCRIPTION_STATE_IN_GRACE_PERIOD; apply your product-specific grace-period policy.

The purchase token is sent to Google over TLS and hashed before persistence. Do not log request bodies or return tokens to clients. Subscription status should be updated from RTDN and cached server-side; do not poll every subscription on a schedule.

## Safety defaults

- No production Play edit is created or committed by default.
- Non-production publishing requires GOOGLE_PLAY_PUBLISHING_ENABLED=true and a matching per-request x-google-play-approval token. Production-track changes and commits additionally require GOOGLE_PLAY_PRODUCTION_PUBLISHING_ENABLED=true and a matching x-google-play-production-approval token.
- Review replies require separate support-write enablement and the same per-request approval mechanism.
- No purchase acknowledgement, consumption, refund, cancellation or payment action is exposed.
- Prisma migration is provided but must be reviewed and applied separately; deployment does not run migrations.
- API routes are protected by a high-entropy admin bearer token. Integrate this with the platform's authenticated organization/role middleware before exposing the module to multiple tenants.

## App Bundle publishing

The Vercel route layer intentionally does not accept large Android App Bundle uploads because serverless request-body limits make that an unreliable release path. Use the Node 24 CLI at scripts/google-play/publish-bundle.mjs from a trusted CI runner or release workstation. It defaults to a local dry run. Remote publishing requires --commit, --approve-publish, GOOGLE_PLAY_PUBLISHING_ENABLED=true and GOOGLE_PLAY_WRITE_APPROVAL_TOKEN. The production track additionally requires GOOGLE_PLAY_PRODUCTION_PUBLISHING_ENABLED=true, GOOGLE_PLAY_PRODUCTION_APPROVAL_TOKEN and --approve-production. The CLI creates a Play edit, uploads the AAB, updates the selected track and commits the edit. Do not expose this command to untrusted pull-request workflows.

## Database migration

Migration SQL is in prisma/migrations/20261102000000_google_play_developer_api/migration.sql. Run pnpm prisma:generate after updating the schema, and apply the migration only after reviewing the target database and taking the normal backup. No migration was run as part of this change.

## Validation before activation

1. Supply the actual Android package name.
2. Confirm the service account exists, has app-level access and belongs to the correct Cloud project.
3. Set server secrets in a non-production preview environment.
4. Apply the migration in a disposable/test database and run Prisma validation, typecheck, tests and build.
5. Configure Pub/Sub OIDC audience/service account and test RTDN duplicate delivery.
6. Validate product and subscription responses against Play test purchases.
7. Keep publishing and support writes disabled until separately approved.
