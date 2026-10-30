import { describe, expect, it } from "vitest";
import { normalizeGoogleSearchInput } from "./google-search";

describe("normalizeGoogleSearchInput", () => {
  it("passes plain text through as a web search", () => {
    expect(normalizeGoogleSearchInput("latest Gemini API")).toEqual({
      query: "latest Gemini API",
      mode: "google-web-search",
    });
  });

  it("extracts the query and identifies an AI Mode URL", () => {
    const result = normalizeGoogleSearchInput(
      "https://www.google.com/search?q=Gemini+grounding&udm=50&aep=43",
    );

    expect(result.query).toBe("Gemini grounding");
    expect(result.mode).toBe("google-ai-mode");
    expect(result.sourceUrl).toContain("udm=50");
  });

  it("rejects the empty query URL from the shared link", () => {
    expect(() =>
      normalizeGoogleSearchInput("https://www.google.com/search?q=&sourceid=chrome-mobile&udm=50"),
    ).toThrow(/empty search query/i);
  });

  it("rejects non-Google URLs", () => {
    expect(() => normalizeGoogleSearchInput("https://example.com/search?q=test")).toThrow(/Only Google Search URLs/);
  });

  it("rejects empty input", () => {
    expect(() => normalizeGoogleSearchInput("  ")).toThrow(/Enter a search query/);
  });
});
