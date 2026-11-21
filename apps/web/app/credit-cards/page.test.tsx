import { describe, expect, it } from "vitest";
import { categorize, isCardPayment, normalizeTransaction, summarize, toPaise } from "../../lib/finance-engine";

describe("finance intelligence", () => {
  it("converts INR to integer paise", () => expect(toPaise("₹1,234.56")).toBe(123456));
  it("categorizes known merchants", () => expect(categorize("UPI-SWIGGY ORDER")).toBe("Food & Dining"));
  it("excludes card repayments from spending", () => expect(isCardPayment("CREDIT CARD PAYMENT THANK YOU")).toBe(true));
  it("normalizes transaction data", () => {
    const tx = normalizeTransaction({date:"2026-03-01",description:"AMAZON INDIA",amount:"-120.50"});
    expect(tx.amountPaise).toBe(-12050);
    expect(tx.category).toBe("Shopping");
  });
  it("nets refunds against spending", () => {
    const rows = [
      normalizeTransaction({id:"1",date:"2026-03-01",description:"AMAZON",amount:"-100"}),
      normalizeTransaction({id:"2",date:"2026-03-02",description:"AMAZON REFUND",amount:"40"}),
      normalizeTransaction({id:"3",date:"2026-03-03",description:"CREDIT CARD PAYMENT",amount:"-140"}),
    ];
    const result = summarize(rows);
    expect(result.totalSpendPaise).toBe(10000);
    expect(result.totalCreditsPaise).toBe(4000);
    expect(result.netSpendPaise).toBe(6000);
  });
});
