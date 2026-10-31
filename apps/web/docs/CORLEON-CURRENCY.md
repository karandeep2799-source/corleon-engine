# Corleon Currency — closed-loop credits

## Product boundary
Corleon (CRL) is an internal, closed-loop promotional / usage credit unit for the merchant's own store network. INR remains the only official settlement currency. CRL is not legal tender, a bank deposit, an investment, a cryptocurrency, or a claim to cash.

This implementation deliberately does not provide:
- Cash redemption, bank withdrawal, P2P transfers, gifting, or customer-to-customer transfer.
- External exchange, public token issuance, blockchain transfers, or INR conversion / peg.
- Customer top-ups or purchase of credits using a payment gateway.
- Interest, yield, or monetary stored-value promises.

If the intended operation changes to prepaid monetary value, transferable balances, broad third-party acceptance, or cash redemption, stop and obtain Indian regulatory advice before implementation. RBI's PPI framework and other payment-system requirements may apply depending on the actual product structure and funds flow. A closed-loop label alone is not a legal exemption.

## Data model
- CurrencyStore: merchant-owned store, scoped to the signed-in user.
- CurrencyWallet: customer identifier scoped to the same owner.
- CurrencyLedgerEntry: append-only signed integer credit entries. Balance is derived by summing entries; no mutable balance field is trusted.
- Ledger writes require a store owned by the current user, a reason, and an idempotency key.
- Serializable database transactions prevent concurrent redemptions from overspending. Serialization conflicts are retried.

## API
- GET /api/currency — stores, customer wallets, current derived balances, recent ledger entries.
- POST /api/currency/stores — create an owner-scoped store.
- POST /api/currency/credits — issue or redeem CRL credits.

Every write requires an authenticated session and same-origin request. Idempotency keys are scoped to the owner and cannot be reused with a different request fingerprint.

## Operations
1. Apply the Prisma migration in a controlled deployment: `pnpm --filter @corleon/web prisma:deploy`.
2. Generate Prisma client and run typecheck/tests/build.
3. Verify sign-in and owner isolation using separate test accounts.
4. Test issue, duplicate replay, insufficient-balance rejection, simultaneous redemption, and cross-store access denial.
5. Configure backups, retention, monitoring, customer support and refund/reversal procedures before production use.

## Important limitations
- This first release has no customer self-service portal, automated expiry worker, refund/reversal workflow, merchant onboarding, GST treatment, payment-provider integration, or regulatory opinion.
- Ledger rows should never be edited or deleted through application routes. Corrections should be represented by compensating entries in a reviewed future workflow.
- This feature does not move or hold INR. Actual customer payments remain external and must settle through a regulated/eligible provider.
