import { createHash } from "node:crypto";
import { DomainError, TranscriptInputSchema, type TranscriptInput, type TranscriptSection } from "./types.js";

const MAX_TRANSCRIPT_BYTES = 8 * 1024 * 1024;

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function normalizeTranscript(raw: string): string {
  const normalized = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (Buffer.byteLength(normalized, "utf8") > MAX_TRANSCRIPT_BYTES) {
    throw new DomainError("Transcript exceeds the 8 MiB processing limit.", "VALIDATION", 413);
  }
  return normalized;
}

const SECTION_MARKERS: Array<{ type: TranscriptSection["sectionType"]; pattern: RegExp }> = [
  { type: "PREPARED_REMARKS", pattern: /^\s*(prepared remarks|presentation)\s*$/im },
  { type: "QUESTION_AND_ANSWER", pattern: /^\s*(question-and-answer session|questions and answers|q\s*&\s*a)\s*$/im },
];

export function splitTranscriptSections(content: string): TranscriptSection[] {
  const matches = SECTION_MARKERS.flatMap(({ type, pattern }) => {
    const match = pattern.exec(content);
    return match?.index === undefined ? [] : [{ type, start: match.index, end: match.index + match[0].length }];
  }).sort((a, b) => a.start - b.start);

  if (matches.length === 0) {
    return [{
      sectionType: "OTHER",
      ordinal: 0,
      content,
      startOffset: 0,
      endOffset: content.length,
    }];
  }

  const sections: TranscriptSection[] = [];
  if (matches[0]!.start > 0) {
    sections.push({
      sectionType: "OTHER",
      ordinal: 0,
      content: content.slice(0, matches[0]!.start).trim(),
      startOffset: 0,
      endOffset: matches[0]!.start,
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]!;
    const next = matches[i + 1];
    const start = current.end;
    const end = next?.start ?? content.length;
    sections.push({
      sectionType: current.type,
      ordinal: sections.length,
      heading: current.type === "QUESTION_AND_ANSWER" ? "Questions and answers" : "Prepared remarks",
      content: content.slice(start, end).trim(),
      startOffset: start,
      endOffset: end,
    });
  }
  return sections.filter((section) => section.content.length > 0);
}

export function validateTranscriptInput(input: unknown): TranscriptInput {
  const parsed = TranscriptInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(parsed.error.issues.map((issue) => issue.message).join("; "), "VALIDATION", 400);
  }
  const normalized = normalizeTranscript(parsed.data.content);
  return { ...parsed.data, content: normalized };
}
