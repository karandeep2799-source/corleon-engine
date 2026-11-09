import { describe, expect, it } from "vitest";
import { extractTradesFromEmail } from "./extract";

const receivedAt = new Date("2026-11-10T10:00:00.000Z");

describe("extractTradesFromEmail", () => {
  it("extracts a natural-language Indian buy and defaults no unmarked currency", () => {
    const trades = extractTradesFromEmail({
      ownerEmail: "Investor@example.com", messageId: "message-1",
      subject: "Trade executed", body: "BUY 10 RELIANCE @ 2500.50",
      receivedAt,
    });
    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({ type: "BUY", symbol: "RELIANCE", quantity: 10, price: 2500.5, currency: "UNKNOWN" });
  });

  it("extracts labelled symbol, side, quantity and INR price", () => {
    const trades = extractTradesFromEmail({
      ownerEmail: "investor@example.com", messageId: "message-2",
      subject: "Execution", body: "SIDE: SELL SYMBOL: TCS QTY: 3 PRICE: ₹4000",
      receivedAt,
    });
    expect(trades[0]).toMatchObject({ type: "SELL", symbol: "TCS", quantity: 3, price: 4000, currency: "INR" });
  });

  it("maps a broker contract-note row with an ISIN column", () => {
    const trades = extractTradesFromEmail({
      ownerEmail: "investor@example.com", messageId: "message-3",
      subject: "Contract note", body: "RELIANCE INE002A01018 B 10 2500.00 NSE",
      receivedAt,
    });
    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({ type: "BUY", symbol: "RELIANCE", quantity: 10, price: 2500, currency: "INR" });
  });

  it("uses the explicit trade date rather than the email received date", () => {
    const trades = extractTradesFromEmail({
      ownerEmail: "investor@example.com", messageId: "message-4",
      subject: "Contract note", body: "Trade Date: 09/11/2026\nBUY 4 INFY @ INR 1500",
      receivedAt,
    });
    expect(trades[0].executedAt.getFullYear()).toBe(2026);
    expect(trades[0].executedAt.getMonth()).toBe(10);
    expect(trades[0].executedAt.getDate()).toBe(9);
  });

  it("is idempotent for repeated identical trade rows in one message", () => {
    const input = {
      ownerEmail: "investor@example.com", messageId: "message-5",
      subject: "Execution", body: "BUY 5 INFY @ INR 100\nBUY 5 INFY @ INR 100",
      receivedAt,
    };
    expect(extractTradesFromEmail(input)).toHaveLength(1);
  });

  it("does not invent a trade when a stock name is only mentioned", () => {
    const trades = extractTradesFromEmail({
      ownerEmail: "investor@example.com", messageId: "message-6",
      subject: "Your portfolio", body: "Your portfolio contains RELIANCE and TCS shares.",
      receivedAt,
    });
    expect(trades).toHaveLength(0);
  });
});

  it("extracts trade rows from a CSV attachment", async () => {
    const { extractTradesFromCsv } = await import("./extract");
    const trades = extractTradesFromCsv({
      ownerEmail: "investor@example.com",
      messageId: "message-csv",
      fileName: "tradebook.csv",
      text: "Symbol,Trade Type,Quantity,Average Price,Trade Date,Currency\nINFY,BUY,12,1450.50,2026-11-09,INR\nTCS,SELL,2,3200,09/11/2026,INR",
      receivedAt,
    });
    expect(trades).toHaveLength(2);
    expect(trades[0]).toMatchObject({ type: "BUY", symbol: "INFY", quantity: 12, price: 1450.5, currency: "INR", confidence: 92 });
    expect(trades[1]).toMatchObject({ type: "SELL", symbol: "TCS", quantity: 2, price: 3200, currency: "INR" });
  });
