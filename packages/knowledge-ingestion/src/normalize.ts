import { createHash } from "node:crypto";
import type { KnowledgeChunkInput } from "./types.js";

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function normalizeKnowledgeText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkKnowledgeText(
  content: string,
  options: { maxChars?: number; overlapChars?: number } = {},
): KnowledgeChunkInput[] {
  const maxChars = options.maxChars ?? 1_200;
  const overlapChars = options.overlapChars ?? 120;
  if (!Number.isInteger(maxChars) || maxChars < 200) throw new Error("maxChars must be an integer >= 200");
  if (!Number.isInteger(overlapChars) || overlapChars < 0 || overlapChars >= maxChars) {
    throw new Error("overlapChars must be >= 0 and smaller than maxChars");
  }
  const normalized = normalizeKnowledgeText(content);
  if (!normalized) return [];

  const chunks: KnowledgeChunkInput[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + maxChars, normalized.length);
    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf("\n", end);
      if (boundary > start + Math.floor(maxChars * 0.6)) end = boundary;
    }
    const text = normalized.slice(start, end).trim();
    if (text) chunks.push({ ordinal: chunks.length, content: text, contentHash: sha256(text) });
    if (end >= normalized.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }
  return chunks;
}
