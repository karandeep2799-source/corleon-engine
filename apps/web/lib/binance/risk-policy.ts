export type ProposedSpotOrder = {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  referencePrice: number;
};

export type RiskAssessment = {
  decision: "REJECTED" | "APPROVED_FOR_SIMULATION_ONLY";
  reasons: string[];
  order: ProposedSpotOrder;
  estimatedNotionalUsdt: number;
  liveExecutionAllowed: false;
};

const DEFAULT_ALLOWED_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT"];

export function assessSpotOrderRisk(order: ProposedSpotOrder): RiskAssessment {
  const reasons: string[] = [];
  const symbol = order.symbol.trim().toUpperCase();
  const allowedSymbols = (process.env.BINANCE_RISK_ALLOWED_SYMBOLS ?? DEFAULT_ALLOWED_SYMBOLS.join(","))
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  const maxNotional = Number(process.env.BINANCE_RISK_MAX_ORDER_NOTIONAL_USDT ?? "25");
  const notional = order.quantity * order.referencePrice;

  if (!/^[A-Z0-9]{5,20}$/.test(symbol)) reasons.push("Invalid symbol.");
  if (!allowedSymbols.includes(symbol)) reasons.push("Symbol is not on the configured allowlist.");
  if (order.side !== "BUY" && order.side !== "SELL") reasons.push("Unsupported order side.");
  if (!Number.isFinite(order.quantity) || order.quantity <= 0) reasons.push("Quantity must be a positive finite number.");
  if (!Number.isFinite(order.referencePrice) || order.referencePrice <= 0) reasons.push("Reference price must be a positive finite number.");
  if (!Number.isFinite(maxNotional) || maxNotional <= 0) reasons.push("A valid maximum order notional must be configured.");
  if (Number.isFinite(notional) && Number.isFinite(maxNotional) && notional > maxNotional) {
    reasons.push("Estimated order notional exceeds the configured per-order limit.");
  }

  return {
    decision: reasons.length ? "REJECTED" : "APPROVED_FOR_SIMULATION_ONLY",
    reasons,
    order: { ...order, symbol },
    estimatedNotionalUsdt: Number.isFinite(notional) ? Number(notional.toFixed(8)) : 0,
    // Live execution remains hard-disabled until persistent exposure, daily loss,
    // idempotency, reconciliation, and user/org authorization controls are deployed.
    liveExecutionAllowed: false,
  };
}
