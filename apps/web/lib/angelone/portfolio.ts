import { timingSafeEqual } from "node:crypto";

const API_BASE_URL = "https://apiconnect.angelone.in";
const REQUEST_TIMEOUT_MS = 8_000;

export class AngelOneApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "AngelOneApiError";
  }
}

export type AngelOneHolding = {
  tradingsymbol: string;
  exchange: string;
  isin?: string;
  quantity: number;
  averageprice: number;
  ltp: number;
  profitandloss: number;
  pnlpercentage: number;
  [key: string]: unknown;
};

export type AngelOnePosition = {
  tradingsymbol: string;
  exchange: string;
  producttype?: string;
  netqty?: string | number;
  netprice?: string | number;
  [key: string]: unknown;
};

type SmartApiEnvelope<T> = {
  status: boolean;
  message?: string;
  errorcode?: string;
  data: T;
};

type AllHoldings = {
  holdings: AngelOneHolding[];
  totalholding?: {
    totalholdingvalue?: number;
    totalinvvalue?: number;
    totalprofitandloss?: number;
    totalpnlpercentage?: number;
  };
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new AngelOneApiError("Angel One integration is not fully configured.", 503);
  return value;
}

export function isAuthorizedAngelOneRequest(request: Request): boolean {
  const expected = process.env.ANGELONE_PORTFOLIO_ACCESS_TOKEN;
  const authorization = request.headers.get("authorization") ?? "";
  if (!expected || !authorization.startsWith("Bearer ")) return false;
  const supplied = authorization.slice(7);
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEnvelope<T>(value: unknown): SmartApiEnvelope<T> {
  if (!isRecord(value) || value.status !== true || !("data" in value)) {
    throw new AngelOneApiError("Angel One returned an unsuccessful or unexpected response.", 502);
  }
  return value as SmartApiEnvelope<T>;
}

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${requiredEnv("ANGELONE_JWT_TOKEN")}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-UserType": "USER",
    "X-SourceID": process.env.ANGELONE_SOURCE_ID?.trim() || "WEB",
    "X-ClientLocalIP": requiredEnv("ANGELONE_CLIENT_LOCAL_IP"),
    "X-ClientPublicIP": requiredEnv("ANGELONE_CLIENT_PUBLIC_IP"),
    "X-MACAddress": requiredEnv("ANGELONE_MAC_ADDRESS"),
    "X-PrivateKey": requiredEnv("ANGELONE_API_KEY"),
  };
}

async function get<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      headers: headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new AngelOneApiError("Angel One is temporarily unreachable. Please retry.", 502);
  }

  if (response.status === 401 || response.status === 403) {
    throw new AngelOneApiError("Angel One rejected the session or API credentials. Refresh your SmartAPI session.", 502);
  }
  if (response.status === 429) {
    throw new AngelOneApiError("Angel One rate limit reached. Please retry later.", 503);
  }
  if (!response.ok) {
    throw new AngelOneApiError("Angel One portfolio request failed.", 502);
  }

  const payload: unknown = await response.json().catch(() => null);
  return parseEnvelope<T>(payload).data;
}

function validHolding(value: unknown): value is AngelOneHolding {
  if (!isRecord(value)) return false;
  return (
    typeof value.tradingsymbol === "string" &&
    typeof value.exchange === "string" &&
    typeof value.quantity === "number" &&
    typeof value.averageprice === "number" &&
    typeof value.ltp === "number" &&
    typeof value.profitandloss === "number" &&
    typeof value.pnlpercentage === "number"
  );
}

export async function getAngelOnePortfolio() {
  const [allHoldings, positions] = await Promise.all([
    get<AllHoldings>("/rest/secure/angelbroking/portfolio/v1/getAllHolding"),
    get<unknown>("/rest/secure/angelbroking/order/v1/getPosition"),
  ]);

  if (!isRecord(allHoldings) || !Array.isArray(allHoldings.holdings) || !allHoldings.holdings.every(validHolding)) {
    throw new AngelOneApiError("Angel One returned an invalid holdings payload.", 502);
  }
  if (!Array.isArray(positions) || !positions.every((item) => isRecord(item))) {
    throw new AngelOneApiError("Angel One returned an invalid positions payload.", 502);
  }

  return {
    broker: "angel-one" as const,
    retrievedAt: new Date().toISOString(),
    holdings: allHoldings.holdings,
    totalholding: allHoldings.totalholding ?? null,
    positions: positions as AngelOnePosition[],
    capabilities: {
      holdings: true,
      positions: true,
      orderPlacement: false,
      orderModification: false,
      orderCancellation: false,
      positionConversion: false,
      fundMovement: false,
    },
  };
}
