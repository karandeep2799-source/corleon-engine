import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AngelOneApiError,
  getAngelOnePortfolio,
  isAuthorizedAngelOneRequest,
} from "./portfolio";

const originalEnv = { ...process.env };
const mockFetch = vi.fn<typeof fetch>();

function setAngelOneEnv() {
  process.env.ANGELONE_PORTFOLIO_ACCESS_TOKEN = "a-long-test-token";
  process.env.ANGELONE_JWT_TOKEN = "test-jwt";
  process.env.ANGELONE_API_KEY = "test-api-key";
  process.env.ANGELONE_CLIENT_LOCAL_IP = "127.0.0.1";
  process.env.ANGELONE_CLIENT_PUBLIC_IP = "203.0.113.10";
  process.env.ANGELONE_MAC_ADDRESS = "00:11:22:33:44:55";
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
  setAngelOneEnv();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

describe("Angel One portfolio access", () => {
  it("rejects requests when access is not configured", () => {
    delete process.env.ANGELONE_PORTFOLIO_ACCESS_TOKEN;
    expect(isAuthorizedAngelOneRequest(new Request("https://local.test/api"))).toBe(false);
  });

  it("rejects missing and incorrect bearer tokens", () => {
    expect(isAuthorizedAngelOneRequest(new Request("https://local.test/api"))).toBe(false);
    expect(isAuthorizedAngelOneRequest(new Request("https://local.test/api", {
      headers: { Authorization: "Bearer wrong-token" },
    }))).toBe(false);
  });

  it("accepts the configured bearer token", () => {
    expect(isAuthorizedAngelOneRequest(new Request("https://local.test/api", {
      headers: { Authorization: "Bearer a-long-test-token" },
    }))).toBe(true);
  });
});

describe("getAngelOnePortfolio", () => {
  it("fails with a configuration error before making a network request", async () => {
    delete process.env.ANGELONE_JWT_TOKEN;
    await expect(getAngelOnePortfolio()).rejects.toMatchObject({
      name: "AngelOneApiError",
      status: 503,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("loads and allowlists holdings and positions from the read-only endpoints", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({
        status: true,
        data: {
          holdings: [{
            tradingsymbol: "INFY",
            exchange: "NSE",
            isin: "INE009A01021",
            quantity: "2",
            averageprice: 100,
            ltp: 110,
            profitandloss: 20,
            pnlpercentage: 10,
            unexpectedPrivateField: "must-not-leak",
          }],
          totalholding: { totalholdingvalue: "220", totalinvvalue: 200, totalprofitandloss: 20, totalpnlpercentage: 10 },
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        status: true,
        data: [{
          tradingsymbol: "INFY",
          exchange: "NSE",
          producttype: "DELIVERY",
          symboltoken: "1594",
          netqty: "2",
          netprice: "100",
          pnl: "20",
          unexpectedPrivateField: "must-not-leak",
        }],
      }));

    const portfolio = await getAngelOnePortfolio();

    expect(portfolio.holdings[0]).toEqual({
      tradingsymbol: "INFY",
      exchange: "NSE",
      isin: "INE009A01021",
      quantity: 2,
      averageprice: 100,
      ltp: 110,
      profitandloss: 20,
      pnlpercentage: 10,
    });
    expect(portfolio.totalholding?.totalholdingvalue).toBe(220);
    expect(portfolio.positions[0]).toEqual({
      tradingsymbol: "INFY",
      exchange: "NSE",
      producttype: "DELIVERY",
      symboltoken: "1594",
      netqty: "2",
      netprice: "100",
      pnl: "20",
    });
    expect(JSON.stringify(portfolio)).not.toContain("unexpectedPrivateField");
    expect(portfolio.capabilities.orderPlacement).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    for (const [url, init] of mockFetch.mock.calls) {
      expect(String(url)).toContain("https://apiconnect.angelone.in/rest/secure/angelbroking/");
      expect(init?.method).toBe("GET");
      expect((init?.headers as Record<string, string>)["X-PrivateKey"]).toBe("test-api-key");
    }
  });

  it("maps upstream rate limits to a retryable service error", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 429 }));
    await expect(getAngelOnePortfolio()).rejects.toMatchObject({ status: 503 });
  });

  it("rejects malformed holdings instead of returning partial financial data", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ status: true, data: { holdings: [{ tradingsymbol: "INFY" }] } }))
      .mockResolvedValueOnce(jsonResponse({ status: true, data: [] }));
    await expect(getAngelOnePortfolio()).rejects.toBeInstanceOf(AngelOneApiError);
  });

  it("rejects unsuccessful SmartAPI envelopes", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ status: false, message: "failed", data: null }))
      .mockResolvedValueOnce(jsonResponse({ status: true, data: [] }));
    await expect(getAngelOnePortfolio()).rejects.toMatchObject({ status: 502 });
  });
});
