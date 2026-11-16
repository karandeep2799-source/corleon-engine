import { afterEach, describe, expect, it } from "vitest";
import { isAuthorizedAngelOneRequest } from "./portfolio";

const originalToken = process.env.ANGELONE_PORTFOLIO_ACCESS_TOKEN;

afterEach(() => {
  if (originalToken === undefined) delete process.env.ANGELONE_PORTFOLIO_ACCESS_TOKEN;
  else process.env.ANGELONE_PORTFOLIO_ACCESS_TOKEN = originalToken;
});

describe("Angel One portfolio access", () => {
  it("rejects requests when access is not configured", () => {
    delete process.env.ANGELONE_PORTFOLIO_ACCESS_TOKEN;
    expect(isAuthorizedAngelOneRequest(new Request("https://local.test/api"))).toBe(false);
  });

  it("rejects missing and incorrect bearer tokens", () => {
    process.env.ANGELONE_PORTFOLIO_ACCESS_TOKEN = "a-long-test-token";
    expect(isAuthorizedAngelOneRequest(new Request("https://local.test/api"))).toBe(false);
    expect(isAuthorizedAngelOneRequest(new Request("https://local.test/api", {
      headers: { Authorization: "Bearer wrong-token" },
    }))).toBe(false);
  });

  it("accepts the configured bearer token", () => {
    process.env.ANGELONE_PORTFOLIO_ACCESS_TOKEN = "a-long-test-token";
    expect(isAuthorizedAngelOneRequest(new Request("https://local.test/api", {
      headers: { Authorization: "Bearer a-long-test-token" },
    }))).toBe(true);
  });
});
