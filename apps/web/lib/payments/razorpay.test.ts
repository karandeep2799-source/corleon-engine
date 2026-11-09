import { afterEach, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { safeIdempotencyKey, validateAmount } from './domain';
import { verifyCheckoutSignature, verifyWebhookSignature } from './razorpay';

const original = { id: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET, webhook: process.env.RAZORPAY_WEBHOOK_SECRET };
afterEach(() => {
  process.env.RAZORPAY_KEY_ID = original.id;
  process.env.RAZORPAY_KEY_SECRET = original.secret;
  process.env.RAZORPAY_WEBHOOK_SECRET = original.webhook;
});

describe('payment domain', () => {
  it('accepts integer paise within configured bounds', () => {
    expect(validateAmount(100)).toBe(100);
    expect(() => validateAmount(1.5)).toThrow();
    expect(() => validateAmount(0)).toThrow();
  });
  it('validates idempotency keys', () => {
    expect(safeIdempotencyKey('checkout:1234567890')).toBe('checkout:1234567890');
    expect(() => safeIdempotencyKey('x')).toThrow();
  });
});

describe('Razorpay signatures', () => {
  it('validates checkout signatures and rejects tampering', () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_example';
    process.env.RAZORPAY_KEY_SECRET = 'test_secret';
    const signature = createHmac('sha256', 'test_secret').update('order_123|pay_123').digest('hex');
    expect(verifyCheckoutSignature('order_123', 'pay_123', signature)).toBe(true);
    expect(verifyCheckoutSignature('order_123', 'pay_999', signature)).toBe(false);
  });
  it('validates webhook signatures', () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook_secret';
    const body = '{"event":"payment.captured"}';
    const signature = createHmac('sha256', 'webhook_secret').update(body).digest('hex');
    expect(verifyWebhookSignature(body, signature)).toBe(true);
    expect(verifyWebhookSignature(body + ' ', signature)).toBe(false);
  });
});
