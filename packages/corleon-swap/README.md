# @corleon/swap shared exchange module

This package boundary is reserved for Corleon Engine shared DEX domain services. The standalone Next.js surface lives at apps/web/app/swap; Engine integrations should consume this package rather than duplicate chain policy.

## Guarantees
- Sepolia and Base Sepolia are the only allowed chain IDs in the quote request boundary.
- Quote endpoint validates chain IDs, token addresses, and decimal amounts.
- It returns unavailable until a verified provider and liquidity source are configured; it never invents a price.
- Transaction execution is intentionally not implemented or enabled.

## Activation gates
1. Pin audited router and factory addresses per chain.
2. Configure read-only RPC endpoints and provider credentials in the deployment secret manager.
3. Implement provider-backed quotes and simulation with independent response validation.
4. Complete contract audit, fuzzing, invariant testing, and testnet deployment.
5. Add explicit transaction execution approvals and monitoring.
