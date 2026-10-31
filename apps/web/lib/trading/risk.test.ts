import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { validatePreTrade } from './risk';

const policy = { tradingEnabled: true, maxOrderNotional: new Prisma.Decimal(1000), requireLimitOrders: true };
const base = {
  market: 'US_STOCKS' as const,
  symbol: 'COIN',
  side: 'BUY' as const,
  orderType: 'LIMIT' as const,
  quantity: '2',
  limitPrice: '100',
  timeInForce: 'DAY' as const,
  accountId: 'account_1',
  provider: 'alpaca',
  idempotencyKey: '0123456789abcdef',
};

describe('validatePreTrade', () => {
  it('accepts a valid limit order within notional limit', async () => {
    await expect(validatePreTrade(base, policy)).resolves.toBeUndefined();
  });

  it('blocks trading when the market policy is disabled', async () => {
    await expect(validatePreTrade(base, { ...policy, tradingEnabled: false })).rejects.toThrow('TRADING_DISABLED_FOR_MARKET');
  });

  it('requires limit orders by default', async () => {
    await expect(validatePreTrade({ ...base, orderType: 'MARKET' }, policy)).rejects.toThrow('LIMIT_ORDER_REQUIRED');
  });

  it('rejects orders above the notional limit', async () => {
    await expect(validatePreTrade({ ...base, quantity: '11' }, policy)).rejects.toThrow('ORDER_NOTIONAL_LIMIT_EXCEEDED');
  });

  it('rejects non-positive quantity', async () => {
    await expect(validatePreTrade({ ...base, quantity: '0' }, policy)).rejects.toThrow('INVALID_QUANTITY');
  });
});
