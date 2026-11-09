import { Prisma } from '@prisma/client';
import type { OrderRequest } from './types';

export async function validatePreTrade(input: OrderRequest, limit: {
  tradingEnabled: boolean;
  maxOrderNotional: Prisma.Decimal | null;
  requireLimitOrders: boolean;
}) {
  if (!limit.tradingEnabled) throw new Error('TRADING_DISABLED_FOR_MARKET');
  if (!/^[A-Z0-9._:-]{1,32}$/.test(input.symbol)) throw new Error('INVALID_SYMBOL');
  const quantity = new Prisma.Decimal(input.quantity);
  if (!quantity.isFinite() || quantity.lte(0)) throw new Error('INVALID_QUANTITY');
  if (limit.requireLimitOrders && input.orderType === 'MARKET') throw new Error('LIMIT_ORDER_REQUIRED');
  if (input.orderType.includes('LIMIT') && !input.limitPrice) throw new Error('LIMIT_PRICE_REQUIRED');
  if (input.orderType.includes('STOP') && !input.stopPrice) throw new Error('STOP_PRICE_REQUIRED');
  if (input.limitPrice && (!new Prisma.Decimal(input.limitPrice).isFinite() || new Prisma.Decimal(input.limitPrice).lte(0))) {
    throw new Error('INVALID_LIMIT_PRICE');
  }
  if (input.stopPrice && (!new Prisma.Decimal(input.stopPrice).isFinite() || new Prisma.Decimal(input.stopPrice).lte(0))) {
    throw new Error('INVALID_STOP_PRICE');
  }
  if (limit.maxOrderNotional && input.limitPrice) {
    const notional = quantity.mul(input.limitPrice);
    if (notional.gt(limit.maxOrderNotional)) throw new Error('ORDER_NOTIONAL_LIMIT_EXCEEDED');
  }
}
