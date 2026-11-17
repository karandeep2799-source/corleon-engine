import { describe, expect, it } from "vitest";
import { googlePayWalletMcp } from "./google-pay-wallet-mcp";

describe("Google Pay & Wallet Developer MCP registry", () => {
  it("points only to Google's official remote MCP endpoint", () => {
    expect(googlePayWalletMcp.endpoint).toBe("https://paydeveloper.googleapis.com/mcp");
    expect(googlePayWalletMcp.transport).toBe("http");
  });

  it("declares OAuth scopes and no API-key authentication", () => {
    expect(googlePayWalletMcp.authentication).toBe("oauth2");
    expect(googlePayWalletMcp.apiKeyAuthentication).toBe(false);
    expect(googlePayWalletMcp.oauthScopes).toContain("https://www.googleapis.com/auth/paydeveloper.merchant");
    expect(googlePayWalletMcp.oauthScopes).toContain("https://www.googleapis.com/auth/paydeveloper.issuer.readonly");
  });

  it("keeps production mutations and payment processing disabled", () => {
    expect(googlePayWalletMcp.productionMutationsEnabled).toBe(false);
    expect(googlePayWalletMcp.paymentProcessingEnabled).toBe(false);
    expect(googlePayWalletMcp.environment).toBe("development");
  });
});
