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
});

describe("Blockscout pagination cursor validation", () => {
  it("accepts opaque cursor objects and preserves future scalar fields", () => {
    expect(parsePaginationCursor({ block_number: 100, index: 2, future_cursor_key: "opaque-value" })).toEqual({
      block_number: "100",
      index: "2",
      future_cursor_key: "opaque-value",
    });
  });

  it("accepts JSON-string cursors and preserves independent fields", () => {
    expect(parsePaginationCursor(JSON.stringify({ block_number: 100, transaction_hash: "0xabc", index: 3 }))).toEqual({
      block_number: "100",
      transaction_hash: "0xabc",
      index: "3",
    });
  });

  it("rejects malformed JSON and oversized string cursors", () => {
    expect(() => parsePaginationCursor("{bad json")).toThrow(/JSON/i);
    expect(() => parsePaginationCursor("x".repeat(2049))).toThrow(/oversized/i);
  });

  it("rejects empty, array, and non-object cursors", () => {
    expect(() => parsePaginationCursor({})).toThrow(/supported fields/i);
    expect(() => parsePaginationCursor("[]")).toThrow(/supported fields/i);
    expect(() => parsePaginationCursor([])).toThrow(/supported fields/i);
  });

  it("rejects oversized serialized objects and individual values", () => {
    expect(() => parsePaginationCursor({ cursor: "x".repeat(2050) })).toThrow(/oversized/i);
    expect(() => parsePaginationCursor({ cursor: "x".repeat(257) })).toThrow(/field is too large/i);
  });

  it("ignores nested, malformed-name, and prototype-sensitive fields", () => {
    expect(parsePaginationCursor({
      nested: { index: 1 },
      "bad-key": "ignored",
      "__proto__": "ignored",
      constructor: "ignored",
      valid_cursor: "kept",
    })).toEqual({ valid_cursor: "kept" });
  });

  it("rejects cursors with no safe scalar fields", () => {
    expect(() => parsePaginationCursor({ nested: { index: 1 }, "bad-key": "ignored" })).toThrow(/supported fields/i);
  });
});
