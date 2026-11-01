import { describe, expect, it } from 'vitest';
import { hashPurchaseToken, isSubscriptionEntitled } from '../../../../../src/google-play/store.js';

describe('Google Play purchase helpers', () => {
  it('hashes purchase tokens deterministically without returning the token', () => {
    const token = 'test-purchase-token';
    const hash = hashPurchaseToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(token);
    expect(hashPurchaseToken(token)).toBe(hash);
  });

  it('grants entitlement to active and grace-period subscriptions', () => {
    expect(isSubscriptionEntitled({ subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE' })).toBe(true);
    expect(isSubscriptionEntitled({ subscriptionState: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' })).toBe(true);
  });

  it('keeps canceled subscriptions entitled only until their line-item expiry', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isSubscriptionEntitled({ subscriptionState: 'SUBSCRIPTION_STATE_CANCELED', lineItems: [{ expiryTime: future }] })).toBe(true);
    expect(isSubscriptionEntitled({ subscriptionState: 'SUBSCRIPTION_STATE_CANCELED', lineItems: [{ expiryTime: past }] })).toBe(false);
  });

  it('does not grant entitlement to pending, paused, on-hold or expired subscriptions', () => {
    for (const subscriptionState of ['SUBSCRIPTION_STATE_PENDING', 'SUBSCRIPTION_STATE_PAUSED', 'SUBSCRIPTION_STATE_ON_HOLD', 'SUBSCRIPTION_STATE_EXPIRED']) {
      expect(isSubscriptionEntitled({ subscriptionState })).toBe(false);
    }
  });
});
