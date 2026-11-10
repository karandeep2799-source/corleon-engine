# Corleon Swap operational runbook

## Safe initial state
- executionEnabled=false
- liveNetworksEnabled=false
- Quote integrations disabled until verified.
- Do not add mainnet RPCs or production contract addresses to the allowlist.

## Before enabling testnet quotes
1. Configure SEPOLIA_RPC_URL and/or BASE_SEPOLIA_RPC_URL in the secret manager.
2. Add reviewed token lists and verified router addresses.
3. Configure provider credentials server-side only.
4. Test malformed addresses, decimal overflow, stale quotes, unsupported chain IDs, and provider outages.
5. Confirm the API returns unavailable on any uncertain or partial provider response.

## Incident response
Immediately disable the relevant chain in server configuration if a router address is compromised, provider output becomes inconsistent, or abnormal transaction activity is observed. Preserve logs and incident evidence. Never hot-patch production contract addresses without review.

## Release policy
No mainnet deployment, production promotion, token listing, custody, or transaction execution without separate explicit approval.
