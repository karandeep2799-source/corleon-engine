# Google Pay & Wallet Developer MCP + Web Checkout

**Status:** integration foundation; live charging is intentionally disabled. Repository inspection found no established Next.js authentication/session layer and no selected Google Pay-compatible processor. Do not enable production checkout until those are implemented and tested.

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
- `GOOGLE_PAY_GATEWAY` and `GOOGLE_PAY_GATEWAY_MERCHANT_ID` from the selected processor's official instructions.
- `GOOGLE_PAY_COUNTRY_CODE=IN`, `GOOGLE_PAY_CURRENCY_CODE=INR`.
- `DATABASE_URL` (pooled PostgreSQL URL); configure `DIRECT_URL` if required by the database provider.

## Checkout security
The browser may request a token through Google's official JavaScript library. The server must derive amount and currency from an authenticated server-owned order and send the token directly to the selected PSP's documented Google Pay integration. Never store tokens or write them to logs. Tokens are processor-specific; Stripe, Adyen, Checkout.com, Razorpay, and other gateways are not interchangeable. The charge route therefore returns 503 until application authentication and a reviewed processor adapter are wired.

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
