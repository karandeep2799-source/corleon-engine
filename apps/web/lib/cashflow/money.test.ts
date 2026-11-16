import { describe, expect, it } from "vitest";
import { stripeMajorToMinor, stripeMinorToMajor } from "../../../../src/cashflow/money.js";

describe("Stripe currency amount conversion", () => {
  it("converts two-decimal currency values without floating-point arithmetic", () => {
    expect(stripeMajorToMinor("10.29", "USD")).toBe(1029);
    expect(stripeMinorToMajor(1029, "USD")).toBe("10.29");
  });

  it("converts zero-decimal currencies without multiplying by one hundred", () => {
    expect(stripeMajorToMinor("500", "JPY")).toBe(500);
    expect(stripeMinorToMajor(500, "JPY")).toBe("500");
    expect(stripeMajorToMinor("12.00", "KRW")).toBe(12);
  });

  it("preserves the two-decimal representation of UGX and special payout currencies", () => {
    expect(stripeMinorToMajor(500, "UGX")).toBe("5.00");
    expect(stripeMajorToMinor("5.00", "UGX")).toBe(500);
    expect(() => stripeMajorToMinor("5.50", "UGX")).toThrow(/whole UGX unit/i);
    expect(() => stripeMajorToMinor("5.25", "HUF")).toThrow(/whole HUF unit/i);
  });

  it("accepts excess trailing zeroes but rejects unsupported precision", () => {
    expect(stripeMajorToMinor("12.3400", "USD")).toBe(1234);
    expect(() => stripeMajorToMinor("12.345", "USD")).toThrow(/more precision/i);
    expect(() => stripeMajorToMinor("12.01", "JPY")).toThrow(/more precision/i);
  });

  it("rejects invalid currency codes and non-positive payout amounts", () => {
    expect(() => stripeMajorToMinor("1.00", "US")).toThrow(/currency code/i);
    expect(() => stripeMajorToMinor("0", "USD")).toThrow(/greater than zero/i);
    expect(() => stripeMajorToMinor("-1.00", "USD")).toThrow(/positive/i);
    expect(() => stripeMajorToMinor("1e3", "USD")).toThrow(/positive/i);
  });

  it("supports negative incoming Stripe values for exact ledger representation", () => {
    expect(stripeMinorToMajor(-1299, "USD")).toBe("-12.99");
  });
});
