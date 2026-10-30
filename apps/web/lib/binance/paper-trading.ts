import { getBinance24HourTicker } from "./market-data";
import { assessSpotOrderRisk } from "./risk-policy";

export async function previewPaperTrade(input: { symbol: string; side: "BUY" | "SELL"; quantity: number }) {
  const symbol = input.symbol.trim().toUpperCase();
  const allowed = (process.env.BINANCE_PAPER_ALLOWED_SYMBOLS ?? "BTCUSDT,ETHUSDT,BNBUSDT").split(",").map(x => x.trim().toUpperCase()).filter(Boolean);
  const maxNotional = Number(process.env.BINANCE_PAPER_MAX_NOTIONAL_USDT ?? "100");
  if (!/^[A-Z0-9]{5,20}$/.test(symbol) || !allowed.includes(symbol)) throw new Error("Symbol is not enabled for paper trading.");
  if (input.side !== "BUY" && input.side !== "SELL") throw new Error("Side must be BUY or SELL.");
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error("Quantity must be a positive finite number.");
  if (!Number.isFinite(maxNotional) || maxNotional <= 0) throw new Error("Paper trading risk configuration is invalid.");

  const ticker = await getBinance24HourTicker(symbol);
  const referencePrice = Number(ticker.lastPrice);
  const notional = referencePrice * input.quantity;
  if (!Number.isFinite(referencePrice) || referencePrice <= 0 || !Number.isFinite(notional)) throw new Error("Market reference price is invalid.");
  const riskAssessment = assessSpotOrderRisk({ symbol, side: input.side, quantity: input.quantity, referencePrice });
  if (riskAssessment.decision === "REJECTED") {
    throw new Error(`Paper trade rejected by risk policy: ${riskAssessment.reasons.join(" ")}`);
  }
  if (notional > maxNotional) throw new Error(`Paper trade exceeds the configured ${maxNotional} USDT notional limit.`);

  const slippageRate = 0.0005;
  const feeRate = 0.001;
  const simulatedExecutionPrice = input.side === "BUY" ? referencePrice * (1 + slippageRate) : referencePrice * (1 - slippageRate);
  const estimatedNotional = simulatedExecutionPrice * input.quantity;
  return {
    mode: "PAPER", liveExecution: false, exchangeOrderSubmitted: false,
    symbol, side: input.side, quantity: input.quantity, referencePrice, simulatedExecutionPrice,
    estimatedNotional, estimatedFee: estimatedNotional * feeRate, feeRate, slippageRate,
    maxNotionalUsdt: maxNotional, riskAssessment, quoteTimestamp: ticker.closeTime, simulatedAt: new Date().toISOString(),
    warnings: ["Simulation only: no Binance order was submitted.", "This endpoint returns a preview only; it does not persist a trade ledger or guarantee executable prices."],
  };
}
