import { createHash } from "node:crypto";
import { sebiPrisma } from "./prisma";

export const SEBI_FEED_URL = "https://www.sebi.gov.in/sebirss.xml";
const ALLOWED_HOSTS = new Set(["www.sebi.gov.in", "investor.sebi.gov.in"]);

export type FeedItem = {
  title: string;
  link: string;
  description: string;
  publishedAt: Date | null;
  category: string;
};

function decodeXml(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16))).trim();
}

function tagValue(xml: string, tag: string): string {
  const match = xml.match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">", "i"));
  return match ? decodeXml(match[1]) : "";
}

export function normalizeSebiUrl(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch { return null; }
}

export function classifySebiItem(title: string, description: string): string {
  const text = (title + " " + description).toLowerCase();
  if (/circular|master circular/.test(text)) return "Circular";
  if (/regulation|amendment|notification/.test(text)) return "Regulation";
  if (/order|adjudication|settlement|ruling|tribunal/.test(text)) return "Enforcement";
  if (/press release|media release/.test(text)) return "Press release";
  if (/mutual fund|alternative investment|portfolio manager|investment adviser|research analyst/.test(text)) return "Intermediaries";
  if (/investor|complaint|grievance|scores/.test(text)) return "Investor protection";
  return "Other";
}

export function parseSebiRss(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  for (const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];
    const title = tagValue(block, "title").slice(0, 500);
    const link = normalizeSebiUrl(tagValue(block, "link"));
    if (!title || !link) continue;
    const description = tagValue(block, "description").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 12000);
    const dateText = tagValue(block, "pubDate");
    const parsedDate = dateText ? new Date(dateText) : null;
    items.push({ title, link, description, publishedAt: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null, category: classifySebiItem(title, description) });
  }
  return items;
}

export async function ingestSebiFeed() {
  const run = await sebiPrisma.sebiIngestionRun.create({ data: { sourceUrl: SEBI_FEED_URL, status: "RUNNING" } });
  let inserted = 0, updated = 0, discovered = 0;
  try {
    const response = await fetch(SEBI_FEED_URL, {
      headers: { "User-Agent": "Corleon-SEBI-Intelligence/1.0 (+https://corleon-engine.vercel.app)" },
      signal: AbortSignal.timeout(15000), cache: "no-store",
    });
    if (!response.ok) throw new Error("SEBI RSS returned HTTP " + response.status);
    const xml = await response.text();
    if (xml.length > 1500000) throw new Error("SEBI RSS feed exceeded the 1.5 MB safety limit");
    const items = parseSebiRss(xml);
    discovered = items.length;
    for (const item of items) {
      const contentHash = createHash("sha256").update([item.title, item.description, item.link, item.publishedAt?.toISOString() ?? ""].join("\n")).digest("hex");
      const existing = await sebiPrisma.sebiDocument.findUnique({ where: { canonicalUrl: item.link }, select: { id: true, contentHash: true } });
      if (existing?.contentHash === contentHash) {
        await sebiPrisma.sebiDocument.update({ where: { id: existing.id }, data: { lastSeenAt: new Date(), fetchedAt: new Date() } });
        continue;
      }
      await sebiPrisma.sebiDocument.upsert({
        where: { canonicalUrl: item.link },
        create: { canonicalUrl: item.link, title: item.title, description: item.description || null, category: item.category, publishedAt: item.publishedAt, sourceUrl: SEBI_FEED_URL, contentHash, status: "DISCOVERED" },
        update: { title: item.title, description: item.description || null, category: item.category, publishedAt: item.publishedAt, sourceUrl: SEBI_FEED_URL, contentHash, fetchedAt: new Date(), lastSeenAt: new Date() },
      });
      if (existing) updated++; else inserted++;
    }
    await sebiPrisma.sebiIngestionRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", discovered, inserted, updated, finishedAt: new Date() } });
    return { runId: run.id, status: "SUCCEEDED", discovered, inserted, updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SEBI ingestion error";
    await sebiPrisma.sebiIngestionRun.update({ where: { id: run.id }, data: { status: "FAILED", discovered, inserted, updated, error: message.slice(0, 4000), finishedAt: new Date() } });
    throw error;
  }
}
