# Corleon Swap architecture

## Product shape
Corleon Swap is delivered as a standalone route in the Corleon Engine Next.js application and as a shared domain package for future Engine surfaces.

## Hybrid liquidity strategy
1. Uniswap adapter: provider-backed read-only quote and route discovery against explicitly allowlisted Uniswap deployments.
2. Corleon AMM: independently owned constant-product pools and router, only after audited contracts are deployed to testnets.
3. Aggregation policy: compare only verified quotes, normalize token decimals, reject stale block data, and apply explicit slippage and price-impact limits. Do not route to unverified tokens or contracts.

## Trust boundaries
- Browser: wallet connection and display only. No seed phrase or private key handling.
- Server: validates quote inputs and returns provider data; never signs transactions.
- Chain: contract execution must enforce min-out, deadline, fee and reentrancy protections.
- Operations: chain allowlist and router addresses are reviewed configuration, never user input.

## Current state
The swap UI is a testnet-only preview. The config endpoint declares integrations disabled. The quote endpoint validates requests and returns unavailable rather than fabricate a quote. No transaction submission, token approvals, mainnet support, or contract deployment is enabled.

## Release gates
- Chain-specific verified deployment addresses and read-only RPC configuration.
- Uniswap API and technical integration review.
- Contract implementation, fuzzing, invariant and fork tests.
- Independent smart-contract audit and remediation.
- Wallet transaction simulation, approval warnings, allowance controls and monitoring.
- Operational runbooks, incident response, rate limiting, abuse protection and compliance review.
