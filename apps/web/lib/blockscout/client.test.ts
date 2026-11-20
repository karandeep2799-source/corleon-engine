import { describe, expect, it } from "vitest";
import { normalizeSupportedChains, parsePaginationCursor, validateAddress } from "./client";

describe("Blockscout client validation", () => {
  it("accepts a valid EVM address and trims whitespace", () => {
    expect(validateAddress("  0xd6eCCeBC1a33f10b432cd5896554182411D840dF ")).toBe("0xd6eCCeBC1a33f10b432cd5896554182411D840dF");
  });
  it("rejects malformed wallet addresses", () => {
    expect(() => validateAddress("0x1234")).toThrow(/valid/i);
    expect(() => validateAddress("https://example.com")).toThrow(/valid/i);
  });
  it("normalizes chain metadata and excludes testnets", () => {
    const chains = normalizeSupportedChains(
      { chains: { "1": {}, "5": {} } },
      { "1": { name: "Ethereum", isTestnet: false, url: "https://eth.blockscout.com", nativeCurrency: { symbol: "ETH" } }, "5": { name: "Goerli", isTestnet: true } },
    );
    expect(chains).toHaveLength(1);
    expect(chains[0]).toMatchObject({ id: "1", name: "Ethereum", nativeCurrencySymbol: "ETH" });
  });
  it("rejects non-HTTPS explorer URLs", () => {
    const chains = normalizeSupportedChains({ chains: { "1": {} } }, { "1": { name: "Ethereum", url: "http://127.0.0.1:8080" } });
    expect(chains[0].explorerUrl).toBeNull();
  });
  it("accepts only bounded, allowlisted pagination fields", () => {
    expect(parsePaginationCursor(JSON.stringify({ block_number: 100, index: 2, injected: "ignored" }))).toEqual({ block_number: "100", index: "2" });
    expect(() => parsePaginationCursor("{bad json")).toThrow(/JSON/i);
    expect(() => parsePaginationCursor("x".repeat(3000))).toThrow(/oversized/i);
  });
});
