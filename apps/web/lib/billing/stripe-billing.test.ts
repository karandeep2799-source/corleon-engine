import { afterEach, describe, expect, it, vi } from 'vitest';
import { authorizeBillingRequest } from '../../../../src/cashflow/stripe-billing.js';

afterEach(() => vi.unstubAllEnvs());

describe('Corleon Stripe billing API authentication', () => {
  it('fails closed when the server token is missing', () => {
    vi.stubEnv('CORLEON_BILLING_API_TOKEN', '');
    expect(authorizeBillingRequest('a'.repeat(64))).toBe(false);
  });

  it('rejects a weak configured token', () => {
    vi.stubEnv('CORLEON_BILLING_API_TOKEN', 'short');
    expect(authorizeBillingRequest('short')).toBe(false);
  });

  it('accepts only the exact server-to-server token', () => {
    const token = 'c'.repeat(64);
    vi.stubEnv('CORLEON_BILLING_API_TOKEN', token);
    expect(authorizeBillingRequest(token)).toBe(true);
    expect(authorizeBillingRequest('d'.repeat(64))).toBe(false);
  });

  it('rejects missing caller credentials', () => {
    vi.stubEnv('CORLEON_BILLING_API_TOKEN', 'c'.repeat(64));
    expect(authorizeBillingRequest(undefined)).toBe(false);
  });
});
