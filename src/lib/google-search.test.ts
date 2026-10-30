import { describe, expect, it } from "vitest";
import { normalizeGoogleSearchInput } from "./google-search";

describe("normalizeGoogleSearchInput", () => {
  it("passes plain text through", () => {
    expect(normalizeGoogleSearchInput("Gemini API grounding")).toEqual({
      query: "Gemini API grounding",
      mode: "google-web-search",
    });
  });

  it("extracts a Google query and recognizes AI Mode metadata", () => {
    const result = normalizeGoogleSearchInput(
      "https://www.google.com/search?q=Gemini+grounding&udm=50&aep=43",
    );
    expect(result.query).toBe("Gemini grounding");
    expect(result.mode).toBe("google-ai-mode");
  });

  it("rejects the supplied empty q= URL", () => {
    expect(() => normalizeGoogleSearchInput(
      "https://www.google.com/search?q=&sourceid=chrome-mobile&udm=50",
    )).toThrow(/empty search query/i);
  });

  it("rejects non-Google URLs", () => {
    expect(() => normalizeGoogleSearchInput("https://example.com/search?q=test")).toThrow(/Only Google Search URLs/);
  });

  it("rejects empty input", () => {
    expect(() => normalizeGoogleSearchInput("  ")).toThrow(/Enter a search query/);
  });
});
