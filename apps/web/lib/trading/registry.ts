import type { BrokerAdapter, Market, OrderRequest } from './types';

class NotConfiguredAdapter implements BrokerAdapter {
  constructor(
    readonly provider: string,
    readonly supportedMarkets: readonly Market[],
  ) {}

  async submitOrder(_order: OrderRequest, _credentialsRef: string): Promise<never> {
    throw new Error(`LIVE_ADAPTER_NOT_CONFIGURED:${this.provider}`);
  }

  async cancelOrder(_externalOrderId: string, _credentialsRef: string): Promise<never> {
    throw new Error(`LIVE_ADAPTER_NOT_CONFIGURED:${this.provider}`);
  }
}

// Provider integrations are intentionally fail-closed until credentials, scopes,
// compliance approval, and provider-specific contract tests are configured.
const adapters: Record<string, BrokerAdapter> = {
  alpaca: new NotConfiguredAdapter('alpaca', ['US_STOCKS']),
  interactive_brokers: new NotConfiguredAdapter('interactive_brokers', ['US_STOCKS', 'FOREX', 'COMMODITIES']),
  coinbase_advanced: new NotConfiguredAdapter('coinbase_advanced', ['CRYPTO']),
  zerodha: new NotConfiguredAdapter('zerodha', ['INDIAN_EQUITIES', 'COMMODITIES']),
  upstox: new NotConfiguredAdapter('upstox', ['INDIAN_EQUITIES', 'COMMODITIES']),
};

export function getBrokerAdapter(provider: string) {
  return adapters[provider];
}
