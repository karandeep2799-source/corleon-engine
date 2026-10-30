export type GoogleSearchMode = "google-ai-mode" | "google-web-search";

export interface NormalizedGoogleSearchInput {
  query: string;
  mode: GoogleSearchMode;
  sourceUrl?: string;
}

/**
 * Accepts either a plain search query or a Google Search URL.
 * Consumer-facing URL flags are interpreted only as input metadata; they are
 * never used as an undocumented Google API.
 */
export function normalizeGoogleSearchInput(input: string): NormalizedGoogleSearchInput {
  const value = input.trim();

  if (!value) {
    throw new Error("Enter a search query or paste a Google Search URL.");
  }

  if (value.length > 4_000) {
    throw new Error("Search input is too long. Keep it under 4,000 characters.");
  }

  if (/^https?:\/\//i.test(value)) {
    let url: URL;

    try {
      url = new URL(value);
    } catch {
      throw new Error("The supplied URL is invalid.");
    }

    const hostname = url.hostname.toLowerCase();
    if (hostname !== "google.com" && hostname !== "www.google.com" && hostname !== "google.co.in" && hostname !== "www.google.co.in") {
      throw new Error("Only Google Search URLs are supported. Paste a query for other URLs.");
    }

    if (url.pathname !== "/search") {
      throw new Error("This Google URL is not a search-results URL.");
    }

    const query = (url.searchParams.get("q") ?? "").trim();
    if (!query) {
      throw new Error("This Google URL has an empty search query (q=). Add a search term and try again.");
    }

    return {
      query: query.slice(0, 2_000),
      mode: url.searchParams.get("udm") === "50" ? "google-ai-mode" : "google-web-search",
      sourceUrl: url.toString(),
    };
  }

  return {
    query: value.slice(0, 2_000),
    mode: "google-web-search",
  };
}
