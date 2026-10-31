import { afterEach, describe, expect, it } from "vitest";
import { assessSpotOrderRisk } from "./risk-policy";

const originalAllowed = process.env.BINANCE_PAPER_ALLOWED_SYMBOLS;
const originalLimit = process.env.BINANCE_PAPER_MAX_NOTIONAL_USDT;

afterEach(() => {
  if (originalAllowed === undefined) delete process.env.BINANCE_PAPER_ALLOWED_SYMBOLS;
  else process.env.BINANCE_PAPER_ALLOWED_SYMBOLS = originalAllowed;

  if (originalLimit === undefined) delete process.env.BINANCE_PAPER_MAX_NOTIONAL_USDT;
  else process.env.BINANCE_PAPER_MAX_NOTIONAL_USDT = originalLimit;
});

describe("assessSpotOrderRisk", () => {
  it("allows an allowlisted order within the default notional limit for simulation only", () => {
    delete process.env.BINANCE_RISK_ALLOWED_SYMBOLS;
    delete process.env.BINANCE_RISK_MAX_ORDER_NOTIONAL_USDT;

    const result = assessSpotOrderRisk({
      symbol: "btcusdt",
      side: "BUY",
      quantity: 0.0001,
      referencePrice: 60000,
    });

    expect(result.decision).toBe("APPROVED_FOR_SIMULATION_ONLY");
    expect(result.estimatedNotionalUsdt).toBe(6);
    expect(result.liveExecutionAllowed).toBe(false);
  });

  it("rejects symbols outside the allowlist", () => {
    const result = assessSpotOrderRisk({
      symbol: "DOGEUSDT",
      side: "BUY",
      quantity: 1,
      referencePrice: 0.2,
    });

    expect(result.decision).toBe("REJECTED");
    expect(result.reasons).toContain("Symbol is not on the configured allowlist.");
  });

  it("rejects orders above the configured per-order notional ceiling", () => {
    process.env.BINANCE_PAPER_MAX_NOTIONAL_USDT = "10";

    const result = assessSpotOrderRisk({
      symbol: "BTCUSDT",
      side: "BUY",
      quantity: 1,
      referencePrice: 11,
    });

    expect(result.decision).toBe("REJECTED");
    expect(result.reasons).toContain("Estimated order notional exceeds the configured per-order limit.");
  });

  it("rejects non-positive or non-finite inputs", () => {
    const result = assessSpotOrderRisk({
      symbol: "BTCUSDT",
      side: "BUY",
      quantity: Number.NaN,
      referencePrice: -1,
    });

    expect(result.decision).toBe("REJECTED");
    expect(result.liveExecutionAllowed).toBe(false);
  });
});
