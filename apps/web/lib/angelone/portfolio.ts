import { timingSafeEqual } from "node:crypto";

const API_BASE_URL = "https://apiconnect.angelone.in";
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_PORTFOLIO_ROWS = 2_000;

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
};

export type AngelOnePosition = {
  tradingsymbol?: string;
  exchange?: string;
  producttype?: string;
  symboltoken?: string;
  netqty?: string | number;
  netprice?: string | number;
  pnl?: string | number;
  realised?: string | number;
  unrealised?: string | number;
  ltp?: string | number;
};

type SmartApiEnvelope<T> = {
  status: boolean;
  message?: string;
  errorcode?: string;
  data: T;
};

type AllHoldings = {
  holdings: unknown[];
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
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalScalar(value: unknown): string | number | undefined {
  if (typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) return value;
  return undefined;
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
  // Build headers before the network try/catch so configuration errors remain 503s.
  const requestHeaders = headers();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      headers: requestHeaders,
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

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AngelOneApiError("Angel One returned an invalid response.", 502);
  }
  return parseEnvelope<T>(payload).data;
}

function parseHolding(value: unknown): AngelOneHolding | null {
  if (!isRecord(value)) return null;

  const quantity = finiteNumber(value.quantity);
  const averageprice = finiteNumber(value.averageprice);
  const ltp = finiteNumber(value.ltp);
  const profitandloss = finiteNumber(value.profitandloss);
  const pnlpercentage = finiteNumber(value.pnlpercentage);
  const tradingsymbol = optionalText(value.tradingsymbol);
  const exchange = optionalText(value.exchange);

  if (
    !tradingsymbol ||
    !exchange ||
    quantity === undefined ||
    averageprice === undefined ||
    ltp === undefined ||
    profitandloss === undefined ||
    pnlpercentage === undefined
  ) return null;

  return {
    tradingsymbol,
    exchange,
    quantity,
    averageprice,
    ltp,
    profitandloss,
    pnlpercentage,
    ...(optionalText(value.isin) ? { isin: optionalText(value.isin) } : {}),
  };
}

function parsePosition(value: unknown): AngelOnePosition | null {
  if (!isRecord(value)) return null;
  const position: AngelOnePosition = {};
  const textFields = ["tradingsymbol", "exchange", "producttype", "symboltoken"] as const;
  const scalarFields = ["netqty", "netprice", "pnl", "realised", "unrealised", "ltp"] as const;

  for (const field of textFields) {
    const parsed = optionalText(value[field]);
    if (parsed !== undefined) position[field] = parsed;
  }
  for (const field of scalarFields) {
    const parsed = optionalScalar(value[field]);
    if (parsed !== undefined) position[field] = parsed;
  }
  return position;
}

function parseTotalHolding(value: unknown): AllHoldings["totalholding"] | undefined {
  if (!isRecord(value)) return undefined;
  const fields = ["totalholdingvalue", "totalinvvalue", "totalprofitandloss", "totalpnlpercentage"] as const;
  const result: NonNullable<AllHoldings["totalholding"]> = {};
  for (const field of fields) {
    const parsed = finiteNumber(value[field]);
    if (parsed !== undefined) result[field] = parsed;
  }
  return result;
}

export async function getAngelOnePortfolio() {
  const [allHoldings, positions] = await Promise.all([
    get<unknown>("/rest/secure/angelbroking/portfolio/v1/getAllHolding"),
    get<unknown>("/rest/secure/angelbroking/order/v1/getPosition"),
  ]);

  if (!isRecord(allHoldings) || !Array.isArray(allHoldings.holdings)) {
    throw new AngelOneApiError("Angel One returned an invalid holdings payload.", 502);
  }
  if (allHoldings.holdings.length > MAX_PORTFOLIO_ROWS) {
    throw new AngelOneApiError("Angel One returned too many holdings to process safely.", 502);
  }
  const holdings = allHoldings.holdings.map(parseHolding);
  if (holdings.some((holding) => holding === null)) {
    throw new AngelOneApiError("Angel One returned an invalid holdings payload.", 502);
  }

  if (!Array.isArray(positions) || positions.length > MAX_PORTFOLIO_ROWS) {
    throw new AngelOneApiError("Angel One returned an invalid positions payload.", 502);
  }
  const parsedPositions = positions.map(parsePosition);
  if (parsedPositions.some((position) => position === null)) {
    throw new AngelOneApiError("Angel One returned an invalid positions payload.", 502);
  }

  return {
    broker: "angel-one" as const,
    retrievedAt: new Date().toISOString(),
    holdings,
    totalholding: parseTotalHolding(allHoldings.totalholding) ?? null,
    positions: parsedPositions,
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
