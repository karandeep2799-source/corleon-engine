import { XMLParser } from "fast-xml-parser";

export interface RssItem {
  externalId: string;
  title: string;
  canonicalUrl: string;
  publishedAt?: Date;
  content: string;
  contentMode: "METADATA_ONLY";
  metadata: Record<string, unknown>;
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && "#text" in value) return asText((value as Record<string, unknown>)["#text"]);
  return "";
}

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function safeFeedUrl(rawUrl: string, allowedHosts: string[]): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("RSS feeds must use HTTPS.");
  if (url.username || url.password) throw new Error("Credentials in RSS feed URLs are not allowed.");
  if (!allowedHosts.map((host) => host.toLowerCase()).includes(url.hostname.toLowerCase())) {
    throw new Error("RSS feed host is not on the source allowlist.");
  }
  return url;
}

export async function fetchRssMetadata(input: {
  feedUrl: string;
  allowedHosts: string[];
  fetchImpl?: typeof fetch;
}): Promise<RssItem[]> {
  const url = safeFeedUrl(input.feedUrl, input.allowedHosts);
  const response = await (input.fetchImpl ?? fetch)(url, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(12_000),
    headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
  });
  if (!response.ok) throw new Error(`RSS source returned HTTP ${response.status}.`);
  const xml = await response.text();
  if (xml.length > 2_000_000) throw new Error("RSS response exceeds the 2 MB limit.");
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const rss = parsed.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  const atom = parsed.feed as Record<string, unknown> | undefined;
  const rssItems = channel?.item;
  const atomEntries = atom?.entry;
  const rawItems = rssItems !== undefined ? (Array.isArray(rssItems) ? rssItems : [rssItems]) : (Array.isArray(atomEntries) ? atomEntries : atomEntries ? [atomEntries] : []);
  return rawItems.flatMap((raw): RssItem[] => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const title = asText(item.title);
    const rawLink = typeof item.link === "object" && item.link !== null
      ? asText((item.link as Record<string, unknown>)["@_href"])
      : asText(item.link);
    const canonicalUrl = rawLink ? new URL(rawLink, url).toString() : "";
    if (!title || !canonicalUrl || new URL(canonicalUrl).protocol !== "https:") return [];
    const externalId = asText(first(item.guid)) || asText(item.id) || canonicalUrl;
    const dateText = asText(item.pubDate) || asText(item.published) || asText(item.updated);
    const publishedAt = dateText && !Number.isNaN(Date.parse(dateText)) ? new Date(dateText) : undefined;
    return [{
      externalId,
      title: title.slice(0, 500),
      canonicalUrl,
      ...(publishedAt ? { publishedAt } : {}),
      // RSS connector intentionally indexes metadata only; it does not fetch article pages.
      content: title.slice(0, 500),
      contentMode: "METADATA_ONLY",
      metadata: { feedUrl: url.toString(), itemType: rssItems !== undefined ? "rss" : "atom" },
    }];
  });
}
