import { z } from "zod";

export const FiscalPeriodSchema = z.object({
  fiscalYear: z.number().int().min(1900).max(2200),
  fiscalQuarter: z.number().int().min(1).max(4),
});
export type FiscalPeriod = z.infer<typeof FiscalPeriodSchema>;

export const TranscriptInputSchema = z.object({
  tenantId: z.string().min(1).max(128),
  companyId: z.string().min(1).max(128),
  eventId: z.string().min(1).max(128),
  sourceName: z.string().min(1).max(120),
  sourceUrl: z.string().url().optional(),
  sourceDocumentId: z.string().max(256).optional(),
  sourcePublishedAt: z.coerce.date().optional(),
  content: z.string().min(100).max(2_000_000),
  language: z.string().min(2).max(16).default("en"),
  licenseReference: z.string().max(512).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type TranscriptInput = z.infer<typeof TranscriptInputSchema>;

export const EvidenceSchema = z.object({
  quote: z.string().min(1).max(1200),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().positive(),
  speaker: z.string().max(160).optional(),
  section: z.enum(["PREPARED_REMARKS", "QUESTION_AND_ANSWER", "OTHER"]),
}).refine((v) => v.endOffset > v.startOffset, "Evidence endOffset must exceed startOffset");

export const InsightSchema = z.object({
  category: z.enum([
    "PERFORMANCE", "GUIDANCE", "MANAGEMENT", "ANALYST_SENTIMENT",
    "COMPETITIVE_POSITION", "CAPITAL_ALLOCATION", "RISK", "CATALYST", "THESIS_CHANGE"
  ]),
  polarity: z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"]),
  title: z.string().min(3).max(180),
  summary: z.string().min(10).max(3000),
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceSchema).min(1).max(12),
});
export type Insight = z.infer<typeof InsightSchema>;

export interface TranscriptSection {
  sectionType: "PREPARED_REMARKS" | "QUESTION_AND_ANSWER" | "OPERATOR" | "OTHER";
  ordinal: number;
  heading?: string;
  content: string;
  speaker?: string;
  speakerRole?: string;
  startOffset: number;
  endOffset: number;
}

export interface TranscriptAnalyzer {
  readonly model: string;
  readonly promptVersion: string;
  analyze(input: {
    ticker: string;
    fiscalYear: number;
    fiscalQuarter: number;
    transcript: string;
  }): Promise<{ insights: unknown[]; questions?: unknown[]; promises?: unknown[] }>;
}

export interface TenantAuthorizer {
  assertCanRead(tenantId: string, actorId: string): Promise<void>;
  assertCanWrite(tenantId: string, actorId: string): Promise<void>;
}

export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: "VALIDATION" | "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "SOURCE_POLICY" | "INTERNAL",
    readonly status: number,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
