# Corleon Stock Intelligence

Private, read-only Gmail stock-record discovery inside Corleon Engine.

## What it does

- Links one Google mailbox using OAuth 2.0 and the Gmail gmail.readonly scope.
- Searches Gmail for contract notes, trade confirmations, trade books, weekly and retention statements, funds-and-securities reports, client-master/account-opening records, dividends, demat/CAS, CDSL and NSDL terms.
- Pages through Gmail search results in batches of up to 100 messages; a later scan request resumes from the stored Gmail page token.
- Reads message text and supported plain-text, CSV and TSV attachments (maximum 1 MB per attachment).
- Extracts candidate BUY/SELL rows with deterministic patterns and keeps a subject, sender, received date, filename list and short evidence excerpt.
- Requires manual approval before candidate trades affect the confirmed holdings calculation.
- Builds open positions from approved BUY/SELL rows and shows remaining cost basis and simplified realized P&L by currency.
- Provides a disconnect action that attempts to revoke the Google grant and deletes the mailbox's imported stock records.

## Deliberate first-release boundaries

This is a review-first extraction tool, not a broker integration or a certified portfolio ledger.

- PDF, password-protected PDF, image scans, XLS/XLSX and other binary attachments are identified by filename and MIME type but not parsed. Weekly broker statements, retention statements, CDSL/NSDL e-CAS and many contract notes commonly arrive as PDFs, so these important statement formats are not yet extracted. Passwords must never be sent to Corleon in chat or stored as application configuration; a future in-product flow should handle them ephemerally and locally or through an appropriately reviewed secure parser.
- The initial parser handles common text patterns and tabular trade rows. It does not yet fully normalize every broker's contract note template, all ISINs, exchange-specific symbols, options/futures, corporate actions, dividends, mutual funds or tax-lot accounting.
- Symbols are not a security master. The same ticker can refer to different securities on different venues; an ISIN-backed security mapping is a required next phase before a consolidated global portfolio can be trusted.
- The displayed cost basis is calculated only from confirmed BUY/SELL rows, grouped by currency. It is not a live market valuation, tax computation, or broker statement reconciliation.
- A trade date is taken from a recognized explicit trade-date label where present; otherwise the message's received date is used. Check this value against the original email.
- Parser scores are rule-match heuristics, not calibrated probabilities. They must not be treated as verification.
- No orders, transfers, withdrawals, trades, wallet actions or email modifications are performed.

## Data and privacy model

- The Gmail message body is processed in memory for extraction and is not saved as a complete email body.
- The database stores a Google email address, display metadata, a server-encrypted refresh token, granted scope names, Gmail message/thread IDs, subjects, senders, received dates, attachment filenames/MIME types, extracted transactions and short evidence excerpts.
- Refresh tokens are encrypted with AES-256-GCM using STOCKS_TOKEN_ENCRYPTION_KEY; application sessions are HMAC-SHA256 signed with STOCKS_SESSION_SECRET.
- The session cookie is HTTP-only, SameSite=Lax and Secure in production.
- State-changing requests require a same-origin Origin header. OAuth uses state and PKCE.
- Disconnect attempts Google token revocation and deletes the local connection, sync state, evidence and transactions. If Google's revoke endpoint cannot be reached, local deletion still proceeds and the API reports googleRevoked: false.
- Do not add AI processing of Gmail contents without a distinct, explicit in-product disclosure and consent. This release does not send Gmail contents to a model provider.

## Required environment

Configure these only in the deployment environment manager or a local untracked .env file. Never commit populated secrets.

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | PostgreSQL connection |
| GOOGLE_OAUTH_CLIENT_ID | Google OAuth web client ID |
| GOOGLE_OAUTH_CLIENT_SECRET | Google OAuth web client secret |
| GOOGLE_OAUTH_REDIRECT_URI | Exact callback URL, ending in /api/stocks/auth/callback |
| STOCKS_SESSION_SECRET | At least 32 random characters |
| STOCKS_TOKEN_ENCRYPTION_KEY | Base64-encoded 32-byte key |

Generate the two Corleon secrets locally:

    openssl rand -hex 32
    openssl rand -base64 32

Use the first value for STOCKS_SESSION_SECRET and the second for STOCKS_TOKEN_ENCRYPTION_KEY.

## Google Cloud setup

1. Select the Google Cloud project that will own this feature and enable the Gmail API.
2. Configure the OAuth consent screen, product name, support contact, authorized domains, privacy policy and terms of service.
3. Create an OAuth 2.0 Client ID with application type Web application.
4. Add the exact redirect URL from GOOGLE_OAUTH_REDIRECT_URI to Authorized redirect URIs.
5. Request only the scopes this feature uses: openid, email, profile, and https://www.googleapis.com/auth/gmail.readonly.
6. Add test users while in Testing mode and verify the sign-in, mailbox scan, disconnect and deletion flow.
7. Before inviting general users, complete the OAuth verification and any required restricted-scope security assessment. Gmail gmail.readonly is a restricted scope. Public production launch is blocked until Google's review requirements and the application's privacy disclosures are satisfied.

### Google policy considerations

Google classifies Gmail API scopes separately from basic sign-in. The Gmail read-only scope gives access to mailbox message content and attachments, so the scope must be explained clearly and only the data needed for the visible portfolio feature should be processed. Review Google's current Gmail scope classification, OAuth verification instructions and Workspace user-data / Limited Use policy before launch.


## Public-launch compliance gates

The current engineering notice at /stocks/privacy is not a finished legal privacy policy. Before public release, the operator must supply the legal entity name, registered address, privacy contact, data retention schedule, backup-deletion schedule and subprocessor list, then publish a legally reviewed privacy policy.

The requested Gmail scope is restricted. Google requires OAuth verification for public use of restricted scopes and a security assessment when restricted-scope data is stored on or transmitted by application servers. The public-launch plan must account for Google's CASA requirements, encryption at rest, HTTPS, encrypted OAuth refresh tokens and appropriate key management. The sample environment-variable encryption key is intended for development and must not be assumed to satisfy a production security assessment.

Google's Workspace policy requires a prominent disclosure immediately before user consent, a privacy-policy URL in the OAuth client configuration, user-facing deletion instructions and strict Limited Use restrictions. It also prohibits creating permanent copies of Google user data. The precise retention and persistence model for derived portfolio records must be reviewed against the current Google policy and any conditions imposed during OAuth verification. Do not invite general users or enable production Gmail access until this review is complete.

## Database migration

The schema change and SQL migration are committed but are not applied automatically.

Local development:

    pnpm prisma:generate
    pnpm prisma:migrate

For a controlled release, first back up PostgreSQL, review the migration, run it in staging, then use pnpm prisma:deploy during an approved release. Do not run this migration from a preview build or as an implicit production deployment step.

## Routes

| Route | Purpose |
| --- | --- |
| GET /stocks | Private workspace, not indexed |
| GET /api/stocks/auth/google | Begin Google OAuth |
| GET /api/stocks/auth/callback | Validate OAuth state, exchange code and save encrypted refresh token |
| POST /api/stocks/auth/logout | Revoke the Google grant if possible and delete imported data |
| POST /api/stocks/sync | Process one Gmail result page |
| GET /api/stocks/portfolio | Return the signed-in mailbox's portfolio and evidence |
| PATCH /api/stocks/transactions/:id | Confirm or ignore one candidate trade |

## Validation checklist

- [ ] pnpm install --frozen-lockfile
- [ ] pnpm prisma:generate
- [ ] pnpm --filter @corleon/web typecheck
- [ ] pnpm --filter @corleon/web test
- [ ] pnpm --filter @corleon/web lint
- [ ] pnpm --filter @corleon/web build
- [ ] Apply migration to a disposable PostgreSQL database and verify all tables/indexes.
- [ ] Verify OAuth state mismatch is rejected.
- [ ] Verify unverified Google email is rejected.
- [ ] Verify refresh token is encrypted at rest and never returned in API JSON.
- [ ] Verify one mailbox cannot read or update another mailbox's records.
- [ ] Verify CSV and text attachment extraction, duplicate retries and Gmail page-token continuation.
- [ ] Verify PDF/encrypted e-CAS files are visibly marked as unsupported rather than silently treated as imported holdings.
- [ ] Verify disconnect revokes the Google grant and removes local data.
- [ ] Complete Google's OAuth verification and any required security assessment before public launch.
