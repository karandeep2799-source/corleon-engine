# Corleon Finance Intelligence

The standalone-style credit-card workspace is available at `/credit-cards`; the embedded Corleon Engine module is available at `/finance/credit-cards`. Both are routes in the existing Next.js deployment and use the same domain logic in `apps/web/lib/finance-engine.ts`.

## Parser integration contract

Configure `HDFC_PARSER_URL` to a private parser gateway that accepts multipart fields `statement`, `cardholderName`, and `pdfPassword`, plus a bearer token. It must return JSON with a `transactions` array. Each transaction must include an ISO-compatible `date`, `description`, and either signed decimal rupees in `amount` or integer paise in `amountPaise`; `rewardPoints` is optional.

The pinned Rust adapter lives in `services/hdfc-parser`. Build it from the repository root after `git submodule update --init --recursive`, then set `HDFC_PARSER_URL` to its private `/v1/parse` endpoint. Keep the parser off the public internet. The web route caps uploads at 4 MB to stay within serverless request-body constraints; the internal parser service accepts up to 15 MB and 100 pages.

## Security and privacy

- Set `FINANCE_API_TOKEN` and `HDFC_PARSER_TOKEN` in the deployment secret manager. Never commit their values.
- The browser sends the finance access token only in the authorization header; it is not persisted in local storage.
- The route rejects non-PDF uploads, malformed PDF signatures, files over 4 MB, and oversized cardholder/password fields.
- The API disables caching and does not persist statement contents or parsed transactions. The 4 MB web upload ceiling accounts for serverless request-body overhead.
- Configure a real authenticated user/session boundary and per-user quotas before enabling multi-user production access. The shared token is an interim private-access gate, not a substitute for identity/tenant authorization.
- Use TLS between the app and parser. Restrict the parser to authenticated requests and private network ingress.
- Bank connectivity, bill payment, card controls and financial execution are out of scope. This is statement analysis only.

## Parser source

Original parser: https://github.com/joeirimpan/hdfc-cc-parser-rs (MIT). Its README describes support for selected HDFC statement formats; validate real-world statement variants before relying on extracted results.
