import { describe, expect, it } from "vitest";
import { canRedeem, normalizeCustomerEmail, parseCreditAmount, storeSlug } from "./policy";

describe("Corleon closed-loop credit policy", () => {
  it("accepts only positive safe integer credit amounts within the configured cap", () => {
    expect(parseCreditAmount(10)).toBe(10);
    expect(parseCreditAmount(0)).toBeNull();
    expect(parseCreditAmount(-1)).toBeNull();
    expect(parseCreditAmount(1.5)).toBeNull();
    expect(parseCreditAmount(1_000_001)).toBeNull();
  });
  it("normalizes customer email identifiers", () => {
    expect(normalizeCustomerEmail("  CUSTOMER@Example.com ")).toBe("customer@example.com");
  });
  it("creates URL-safe store slugs", () => {
    expect(storeSlug("My Store & Café")).toBe("my-store-cafe");
  });
  it("prevents redemption beyond the available balance", () => {
    expect(canRedeem(50, 50)).toBe(true);
    expect(canRedeem(49, 50)).toBe(false);
    expect(canRedeem(50, -1)).toBe(false);
  });
});
