const DEFAULT_BASE_URL = "https://ddh-openapi.worldbank.org";
const REQUEST_TIMEOUT_MS = 12_000;

export class WorldBankApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "WorldBankApiError";
  }
}

function getBaseUrl(): string {
  const configured = process.env.WORLD_BANK_API_BASE_URL?.trim();
  const value = configured || DEFAULT_BASE_URL;
  const url = new URL(value);
  if (url.protocol !== "https:" || !url.hostname.endsWith("worldbank.org")) {
    throw new Error("WORLD_BANK_API_BASE_URL must be an HTTPS World Bank host.");
  }
  return url.toString().replace(/\/$/, "");
}

export async function worldBankGet<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  if (!path.startsWith("/") || path.includes("..")) {
    throw new Error("Invalid World Bank API path.");
  }

  const url = new URL(path, getBaseUrl());
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "Corleon-Global-Data-Intelligence/1.0",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new WorldBankApiError(
      \`World Bank API returned HTTP \${response.status}.\`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

export function jsonError(error: unknown): Response {
  if (error instanceof WorldBankApiError) {
    const status = error.status === 404 ? 404 : error.status === 429 ? 503 : 502;
    return Response.json(
      { error: "world_bank_upstream_error", message: error.message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (error instanceof Error && error.name === "TimeoutError") {
    return Response.json(
      { error: "world_bank_timeout", message: "World Bank data service timed out." },
      { status: 504, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    { error: "internal_error", message: "Unable to retrieve World Bank data." },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

export function boundedInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
