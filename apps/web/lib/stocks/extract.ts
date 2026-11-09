import { createHash } from "node:crypto";

export type ExtractedTrade = {
  type: "BUY" | "SELL";
  symbol: string;
  quantity: number;
  price: number;
  currency: string;
  confidence: number;
  executedAt: Date;
  evidenceExcerpt: string;
  fingerprint: string;
};
const STOP_WORDS = new Set(["BUY", "SELL", "BOUGHT", "SOLD", "SHARES", "STOCK", "STOCKS", "EQUITY", "ORDER", "TRADE", "QTY", "PRICE", "TOTAL", "NSE", "BSE", "INR", "USD", "THE", "AND", "FOR", "WITH", "WAS", "HAS", "YOUR", "DEMAT"]);

function amount(value: string): number {
  return Number(value.replace(/,/g, ""));
}
function normalizeSymbol(value: string): string {
  return value.replace(/[^A-Z0-9&.-]/gi, "").toUpperCase().slice(0, 24);
}
export function extractTradesFromEmail(input: {
  ownerEmail: string; messageId: string; subject: string; body: string; receivedAt: Date;
}): ExtractedTrade[] {
  const text = `${input.subject}\n${input.body}`.replace(/\u00a0/g, " ");
  const lines = text.split(/[\n\r]+/).map((line) => line.trim()).filter(Boolean);
  const trades: ExtractedTrade[] = [];
  const seen = new Set<string>();
  const dateMatch = text.match(/\b(?:trade date|executed on|execution date|date of trade)\s*[:=-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})/i);
  let executedAt = input.receivedAt;
  if (dateMatch?.[1]) {
    const value = dateMatch[1];
    const parts = value.split(/[/-]/).map(Number);
    const parsed = parts[0] > 31 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(parts[2] < 100 ? 2000 + parts[2] : parts[2], parts[1] - 1, parts[0]);
    if (!Number.isNaN(parsed.getTime())) executedAt = parsed;
  }
  const patterns = [
    /\b(BUY|BOUGHT|PURCHASED|SELL|SOLD)\b[^\n]{0,35}?([\d,]+(?:\.\d+)?)\s+(?:SHARES?\s+(?:OF\s+)?)?([A-Z][A-Z0-9&.-]{1,15})\b[^\n]{0,65}?(?:@|\bAT\b|PRICE\s*[:=]?|RATE\s*[:=]?|AVG(?:ERAGE)?\s*[:=]?)[\s₹$]*(?:INR|RS\.?|USD)?\s*([\d,]+(?:\.\d+)?)/i,
    /\b([A-Z][A-Z0-9&.-]{1,15})\b[^\n]{0,30}?\b(BUY|BOUGHT|PURCHASED|SELL|SOLD)\b[^\n]{0,45}?(?:QTY|QUANTITY|SHARES?)\s*[:=]?\s*([\d,]+(?:\.\d+)?)[^\n]{0,35}?(?:PRICE|RATE|AVG(?:ERAGE)?)\s*[:=]?\s*[₹$\s]*(?:INR|RS\.?|USD)?\s*([\d,]+(?:\.\d+)?)/i,
    /\b(?:SIDE|ACTION|TYPE)\s*[:=]\s*(BUY|SELL)\b[^\n]{0,80}?\b(?:SYMBOL|SCRIP)\s*[:=]\s*([A-Z][A-Z0-9&.-]{1,15})\b[^\n]{0,50}?\b(?:QTY|QUANTITY)\s*[:=]\s*([\d,]+(?:\.\d+)?)[^\n]{0,50}?\b(?:PRICE|RATE)\s*[:=]\s*[₹$\s]*(?:INR|RS\.?|USD)?\s*([\d,]+(?:\.\d+)?)/i,
    /\b([A-Z][A-Z0-9&.-]{1,15})(?:-EQ|-BE)?\s+(?:[A-Z]{2}[A-Z0-9]{10}\s+)?([BS])\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)/i,
  ];
  for (const line of lines) {
    for (let i = 0; i < patterns.length; i++) {
      const match = line.match(patterns[i]);
      if (!match) continue;
      const typeText = i === 1 ? match[2] : i === 3 ? match[2] === "B" ? "BUY" : "SELL" : match[1] === "B" ? "BUY" : match[1] === "S" ? "SELL" : match[1];
      const symbolText = i === 1 ? match[1] : i === 3 ? match[1] : i === 2 ? match[2] : match[3];
      const quantityText = i >= 2 ? match[3] : match[2];
      const priceText = match[4];
      const symbol = normalizeSymbol(symbolText).replace(/-(EQ|BE)$/, "");
      const quantity = amount(quantityText);
      const price = amount(priceText);
      if (!symbol || STOP_WORDS.has(symbol) || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) continue;
      const type = /^(BUY|BOUGHT|PURCHASED)$/i.test(typeText) ? "BUY" : "SELL";
      const currency = /\bUSD\b|\$/i.test(line) ? "USD" : /\bINR\b|\bRS\.?\b|₹|\bNSE\b|\bBSE\b/i.test(line) ? "INR" : "UNKNOWN";
      const evidenceExcerpt = line.slice(0, 500);
      const fingerprint = createHash("sha256").update([
        input.ownerEmail.toLowerCase(), input.messageId, type, symbol, quantity, price, input.receivedAt.toISOString(),
      ].join("|")).digest("hex");
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      trades.push({ type, symbol, quantity, price, currency, confidence: i >= 2 ? 82 : 72, executedAt, evidenceExcerpt, fingerprint });
      break;
    }
  }
  return trades.slice(0, 30);
}
