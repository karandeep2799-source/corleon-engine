import { createHmac } from "node:crypto";

const BINANCE_API_BASE_URL = "https://api.binance.com";

export type BinanceBalance = {
  asset: string;
  free: string;
  locked: string;
};

export type BinanceAccountSnapshot = {
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  accountType: string;
  updateTime: number;
  balances: BinanceBalance[];
};

export class BinancePrivateApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "BinancePrivateApiError";
  }
}

function credentials() {
  const apiKey = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new BinancePrivateApiError("Binance account monitoring is not configured.", 503);
  }
  return { apiKey, apiSecret };
}

function isAccountSnapshot(value: unknown): value is BinanceAccountSnapshot {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.canTrade === "boolean" &&
    typeof data.canWithdraw === "boolean" &&
    typeof data.canDeposit === "boolean" &&
    typeof data.accountType === "string" &&
    Array.isArray(data.balances) &&
    data.balances.every((item) => {
      if (!item || typeof item !== "object") return false;
      const balance = item as Record<string, unknown>;
      return (
        typeof balance.asset === "string" &&
        typeof balance.free === "string" &&
        typeof balance.locked === "string"
      );
    })
  );
}

/** Server-only signed USER_DATA request. Never log the URL or signature. */
export async function getBinanceAccountSnapshot(): Promise<BinanceAccountSnapshot> {
  const { apiKey, apiSecret } = credentials();
  const params = new URLSearchParams({
    recvWindow: "5000",
    timestamp: String(Date.now()),
  });
  const signature = createHmac("sha256", apiSecret).update(params.toString()).digest("hex");
  const url = `${BINANCE_API_BASE_URL}/api/v3/account?${params.toString()}&signature=${signature}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { "X-MBX-APIKEY": apiKey, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(7_000),
    });
  } catch {
    throw new BinancePrivateApiError("Binance account service is temporarily unavailable.", 502);
  }

  if (response.status === 401 || response.status === 403) {
    throw new BinancePrivateApiError("Binance rejected the account credentials or permissions.", 502);
  }
  if (response.status === 429 || response.status === 418) {
    throw new BinancePrivateApiError("Binance rate limit reached. Retry later.", 503);
  }
  if (!response.ok) {
    throw new BinancePrivateApiError("Binance account request failed.", 502);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!isAccountSnapshot(payload)) {
    throw new BinancePrivateApiError("Binance returned an unexpected account response.", 502);
  }

  if (payload.canTrade || payload.canWithdraw) {
    throw new BinancePrivateApiError("This API key is not read-only. Disable trading and withdrawal permissions before connecting it.", 403);
  }

  return {
    ...payload,
    // Exclude zero-balance assets to reduce unnecessary account-data exposure.
    balances: payload.balances.filter((item) => {
      const free = Number(item.free);
      const locked = Number(item.locked);
      return Number.isFinite(free) && Number.isFinite(locked) && (free !== 0 || locked !== 0);
    }),
  };
}
