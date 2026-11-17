const BINANCE_MARKET_DATA_BASE_URL = "https://data-api.binance.vision";

export type Binance24HourTicker = {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  askPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  count: number;
};

export class BinanceMarketDataError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "BinanceMarketDataError";
  }
}

function isTicker(value: unknown): value is Binance24HourTicker {
  if (!value || typeof value !== "object") return false;
  const ticker = value as Record<string, unknown>;
  return (
    typeof ticker.symbol === "string" &&
    typeof ticker.lastPrice === "string" &&
    typeof ticker.priceChangePercent === "string" &&
    typeof ticker.volume === "string" &&
    typeof ticker.quoteVolume === "string"
  );
}

/**
 * Fetches public 24-hour Spot market statistics. This endpoint does not use
 * account credentials and cannot access balances or place orders.
 */
export async function getBinance24HourTicker(
  symbol: string,
): Promise<Binance24HourTicker> {
  const normalizedSymbol = symbol.trim().toUpperCase();

  if (!/^[A-Z0-9]{5,20}$/.test(normalizedSymbol)) {
    throw new BinanceMarketDataError("Invalid Binance symbol.", 400);
  }

  let response: Response;
  try {
    response = await fetch(
      `${BINANCE_MARKET_DATA_BASE_URL}/api/v3/ticker/24hr?symbol=${encodeURIComponent(normalizedSymbol)}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5_000),
        next: { revalidate: 15 },
      },
    );
  } catch {
    throw new BinanceMarketDataError("Binance market data is temporarily unavailable.", 502);
  }

  if (response.status === 429 || response.status === 418) {
    throw new BinanceMarketDataError("Binance rate limit reached. Retry later.", 503);
  }

  if (response.status === 400 || response.status === 404) {
    throw new BinanceMarketDataError("The requested Binance market symbol was not found.", 404);
  }

  if (!response.ok) {
    throw new BinanceMarketDataError("Binance returned an upstream error.", 502);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!isTicker(payload)) {
    throw new BinanceMarketDataError("Binance returned an unexpected market-data response.", 502);
  }

  return payload;
}
