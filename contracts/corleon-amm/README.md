# Corleon AMM contracts

Status: specification scaffold only. No contract has been deployed. Do not use this implementation for funds or production. Contract implementation, property tests, formal review, and an independent security audit are release blockers.

## Required design
- Constant-product pools with explicit fee accounting.
- Factory-created pairs with deterministic token ordering.
- Safe ERC-20 transfers and reentrancy protection.
- Minimum output / deadline checks in the router.
- No owner-controlled arbitrary asset transfer.
- Events for pool creation, swaps, liquidity additions and removals.

Only Sepolia and Base Sepolia are in the initial application allowlist. Deployment keys must remain in a dedicated signer or CI secret store; never commit keys or paste them into chat.
