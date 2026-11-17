# Google Pay & Wallet Developer MCP + Web Checkout

**Status:** Google Identity Services sign-in, server-side sessions, explicit customer-user mapping, and Razorpay Standard Checkout foundation are implemented. Live charging remains disabled until the Google OAuth client, customer mappings, Razorpay test credentials, webhook setup, CI, and sandbox end-to-end validation are complete.

## ChatGPT connector
1. In Google Cloud Console, create/select a project and enable the Pay & Wallet Developer API.
2. In Google Auth Platform, create an OAuth client of type **Web application**.
3. Add `https://chatgpt.com` to Authorized JavaScript origins.
4. In ChatGPT, open Settings → Apps (or Plugins/Developer mode, depending on current UI) and create an app/connector named **Google Pay & Wallet MCP** with server URL `https://paydeveloper.googleapis.com/mcp`.
5. Enter the OAuth client ID and secret in advanced settings. Copy ChatGPT's generated callback URL and add that exact URL to Authorized redirect URIs.
6. Connect and authorize only the intended Google identity. Never commit the client secret.

Documented scopes:
- `https://www.googleapis.com/auth/paydeveloper.merchant` — manage merchant integration data.
- `https://www.googleapis.com/auth/paydeveloper.issuer.readonly` — read Wallet issuer data.

The remote MCP service is pre-GA. It manages developer integration data and is not a consumer payment API.

## Vercel environment variables
- `GOOGLE_PAY_ENVIRONMENT=TEST` until merchant approval and sandbox verification.
- `GOOGLE_PAY_MERCHANT_ID` (production merchant ID).
- `GOOGLE_PAY_MERCHANT_NAME`.
- `RAZORPAY_KEY_ID` (public key ID, only returned by the config endpoint when enabled).
- `RAZORPAY_KEY_SECRET` (server-only API secret).
- `RAZORPAY_WEBHOOK_SECRET` (separate webhook HMAC secret).
- `PAYMENTS_ENABLED=false` and `RAZORPAY_CHECKOUT_ENABLED=false` until launch approval.
- `GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` must match the same Google OAuth web client.
- `DATABASE_URL` (pooled PostgreSQL URL); configure `DIRECT_URL` if required by the database provider.

## Corleon application sign-in and customer authorization

The web app provides `/sign-in` using Google Identity Services. The server validates the Google ID token signature against Google's published JWKs and enforces issuer, audience, authorized party, expiry, issued-at, verified email, and a nonce bound to the server-issued CSRF cookie. It then creates a random opaque session token; only its SHA-256 hash is stored in PostgreSQL. The browser receives an HttpOnly, Secure, SameSite=Lax `__Host-corleon_session` cookie.

Configure both `GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to the same Google OAuth **Web application** client ID. Add each deployment origin (including the production Corleon domain and any intended preview origins) to Authorized JavaScript origins. The GIS popup flow does not require a client secret in the browser.

**Important: Google sign-in alone does not grant access to a customer order.** An organization operator must create an explicit `CustomerUser` row linking the signed-in Corleon `User.id` to the relevant `Customer.id`. This can be provisioned through Prisma Studio after confirming both records:
```bash
pnpm exec prisma studio
```
Use the `CustomerUser` model to create the mapping. The checkout API resolves the order only when exactly one order matches the reference and the authenticated user's customer mapping. It does not authorize by email alone. Without a mapping, checkout returns 403.

Session lifetime is 30 days. Logout revokes the server-side session and clears the cookie. Keep the session and Google client configuration in the intended deployment environment only.

## Razorpay checkout security
For India, use Razorpay Standard Checkout and let Razorpay surface Google Pay as a UPI payment option when enabled on the merchant account. This is not Google Pay Web API CARD tokenization. The server creates the Razorpay order from a pending order owned by the authenticated customer, then verifies the callback signature and fetches the payment server-side. Webhooks verify HMAC against the exact raw body and deduplicate with `x-razorpay-event-id`. Never trust client-supplied amount, organization, customer ID, or payment status. Customer ownership is resolved from the server-side session and explicit `CustomerUser` mapping.

## Prisma
Schema adds organization-scoped `PaymentAttempt` idempotency and `PaymentAttemptEvent` audit records. Review a generated migration before production:
```bash
npx prisma format
npx prisma validate
npx prisma migrate dev --name google_pay_payment_attempts
npx prisma generate
```
Never run `migrate dev` against production.

## Verification checklist
- Config route returns no secrets and uses `Cache-Control: no-store`.
- Production config fails closed when merchant/gateway settings are absent.
- Charge route remains disabled until auth and PSP integration are verified.
- Run typecheck, Prisma validation, tests, and sandbox end-to-end payment before launch.

## Official documentation
- MCP setup: https://developers.google.com/pay/api/web/guides/use-pay-wallet-mcp
- Web API tutorial: https://developers.google.com/pay/api/web/guides/tutorial
- Web API overview: https://developers.google.com/pay/api/web/overview
