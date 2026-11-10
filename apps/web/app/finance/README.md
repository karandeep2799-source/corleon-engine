# Corleon Finance Intelligence

The standalone credit-card application is available at `/credit-cards`; the embedded Corleon Engine module is available at `/finance/credit-cards`. Both use the same domain logic in `apps/web/lib/finance-engine.ts`.

## Parser integration contract

Configure `HDFC_PARSER_URL` to a private parser gateway that accepts multipart fields `statement`, `cardholderName`, and `pdfPassword`, plus a bearer token. It must return JSON with a `transactions` array. Each transaction must include an ISO-compatible `date`, `description`, and either signed decimal rupees in `amount` or integer paise in `amountPaise`; `rewardPoints` is optional.

The upstream Rust project is a CLI, not an HTTP service. Deploy a separately isolated adapter around the pinned and audited upstream revision; do not expose the CLI or parser port publicly. The adapter must delete temporary files, avoid logging statement content/passwords, impose PDF/page/CPU limits, and return normalized transaction data.

## Security and privacy

- Set `FINANCE_API_TOKEN` and `HDFC_PARSER_TOKEN` in the deployment secret manager. Never commit their values.
- The browser sends the finance access token only in the authorization header; it is not persisted in local storage.
- The route rejects non-PDF uploads, malformed PDF signatures, files over 15 MB, and oversized cardholder/password fields.
- The API disables caching and does not persist statement contents or parsed transactions.
- Configure a real authenticated user/session boundary and per-user quotas before enabling multi-user production access. The shared token is an interim private-access gate, not a substitute for identity/tenant authorization.
- Use TLS between the app and parser. Restrict the parser to authenticated requests and private network ingress.
- Bank connectivity, bill payment, card controls and financial execution are out of scope. This is statement analysis only.

## Parser source

Original parser: https://github.com/joeirimpan/hdfc-cc-parser-rs (MIT). Its README describes support for selected HDFC statement formats; validate real-world statement variants before relying on extracted results.
