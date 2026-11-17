/**
 * Registry metadata for Google's remote Developer MCP server.
 *
 * This is a developer-tool integration, not a payment processor. OAuth is
 * intentionally delegated to the supported MCP host (Claude Code), which
 * owns the interactive authorization and token lifecycle.
 */
export const googlePayWalletMcp = Object.freeze({
  id: "google-pay-wallet-dev",
  displayName: "Google Pay & Wallet Developer MCP",
  category: "developer-tools",
  transport: "http",
  endpoint: "https://paydeveloper.googleapis.com/mcp",
  lifecycle: "pre-ga",
  authentication: "oauth2",
  apiKeyAuthentication: false,
  oauthScopes: Object.freeze([
    "https://www.googleapis.com/auth/paydeveloper.merchant",
    "https://www.googleapis.com/auth/paydeveloper.issuer.readonly",
  ]),
  capabilities: Object.freeze([
    "official-documentation-search",
    "merchant-integration-management",
    "integration-performance-metrics",
    "wallet-issuer-and-pass-class-discovery",
  ]),
  environment: "development",
  productionMutationsEnabled: false,
  paymentProcessingEnabled: false,
} as const);

export type GooglePayWalletMcpRegistryEntry = typeof googlePayWalletMcp;
