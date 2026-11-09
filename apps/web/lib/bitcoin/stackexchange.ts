const API = "https://api.stackexchange.com/2.3";
const SITE = "bitcoin";

export type StackExchangeQuestion = {
  question_id: number;
  title: string;
  body?: string;
  link: string;
  score: number;
  answer_count: number;
  view_count: number;
  is_answered: boolean;
  creation_date: number;
  last_activity_date: number;
  tags: string[];
  owner?: { display_name?: string; reputation?: number; profile_image?: string };
  accepted_answer_id?: number;
};

type ApiEnvelope<T> = { items: T[]; has_more: boolean; quota_remaining?: number; backoff?: number };

function cleanHtml(value = "") {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}

export async function stackExchange<T>(path: string, params: Record<string, string | number | undefined> = {}) {
  const url = new URL(API + path);
  url.searchParams.set("site", SITE);
  url.searchParams.set("pagesize", "15");
  if (process.env.STACKEXCHANGE_KEY) url.searchParams.set("key", process.env.STACKEXCHANGE_KEY);
  url.searchParams.set("filter", "withbody");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, { next: { revalidate: 300 }, headers: { "User-Agent": "CorleonBitcoinKnowledge/1.0 (https://corleon-engine.vercel.app)" } });
  if (!response.ok) throw new Error(`Stack Exchange API returned ${response.status}`);
  const data = await response.json() as ApiEnvelope<T>;
  if (data.backoff) console.warn("Stack Exchange API requested backoff", data.backoff);
  return data;
}

export { cleanHtml };
