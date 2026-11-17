import { afterEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { secureHexEqual, verifyCheckoutSignature, verifyWebhookSignature } from "./razorpay";

const previous = {
  key: process.env.RAZORPAY_KEY_SECRET,
  webhook: process.env.RAZORPAY_WEBHOOK_SECRET,
};
afterEach(() => {
  if (previous.key === undefined) delete process.env.RAZORPAY_KEY_SECRET; else process.env.RAZORPAY_KEY_SECRET = previous.key;
  if (previous.webhook === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET; else process.env.RAZORPAY_WEBHOOK_SECRET = previous.webhook;
});
describe("Razorpay signature verification", () => {
  it("verifies the checkout signature for order_id|payment_id", () => {
    process.env.RAZORPAY_KEY_SECRET = "test-secret";
    const expected = createHmac("sha256", "test-secret").update("order_123|pay_123").digest("hex");
    expect(verifyCheckoutSignature("order_123", "pay_123", expected)).toBe(true);
    expect(verifyCheckoutSignature("order_other", "pay_123", expected)).toBe(false);
  });
  it("verifies webhooks against exact raw request bytes", () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-secret";
    const raw = '  { "event" : "payment.captured", "payload": {} } \n';
    const expected = createHmac("sha256", "webhook-secret").update(raw, "utf8").digest("hex");
    expect(verifyWebhookSignature(raw, expected)).toBe(true);
    expect(verifyWebhookSignature(raw.trim(), expected)).toBe(false);
  });
  it("compares signatures without accepting malformed or different-length hex", () => {
    expect(secureHexEqual("abcd", "abcd")).toBe(true);
    expect(secureHexEqual("abcd", "abce")).toBe(false);
    expect(secureHexEqual("abcd", "abc")).toBe(false);
    expect(secureHexEqual("not-hex", "not-hex")).toBe(false);
  });
});
