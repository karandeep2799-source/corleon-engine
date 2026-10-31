export const MARKETS = ['US_STOCKS', 'INDIAN_EQUITIES', 'CRYPTO', 'FOREX', 'COMMODITIES'] as const;
export type Market = (typeof MARKETS)[number];
export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';

export type OrderRequest = {
  market: Market;
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: string;
  limitPrice?: string;
  stopPrice?: string;
  timeInForce: 'DAY' | 'GTC' | 'IOC';
  accountId: string;
  provider: string;
  idempotencyKey: string;
};

export type BrokerOrderResult = {
  externalOrderId: string;
  status: 'ACCEPTED' | 'REJECTED';
  submittedAt: Date;
};

export interface BrokerAdapter {
  readonly provider: string;
  readonly supportedMarkets: readonly Market[];
  submitOrder(order: OrderRequest, credentialsRef: string): Promise<BrokerOrderResult>;
  cancelOrder(externalOrderId: string, credentialsRef: string): Promise<void>;
}
