import { createHash } from "node:crypto";
import { DomainError, type TranscriptAnalyzer } from "./types.js";
import { analyzeTranscript } from "./analysis.js";
import { sha256, splitTranscriptSections, validateTranscriptInput } from "./transcript.js";

export interface EarningsRepository {
  findEvent(input: { tenantId: string; eventId: string }): Promise<{
    id: string; tenantId: string; companyId: string; ticker: string; fiscalYear: number; fiscalQuarter: number;
  } | null>;
  findTranscriptByEvent(input: { tenantId: string; eventId: string }): Promise<{ id: string; contentSha256: string; version: number } | null>;
  createTranscript(input: {
    tenantId: string; eventId: string; sourceName: string; sourceUrl?: string; sourceDocumentId?: string;
    sourcePublishedAt?: Date; content: string; contentSha256: string; language: string; wordCount: number;
    licenseReference?: string; metadata?: Record<string, unknown>; version: number;
    sections: ReturnType<typeof splitTranscriptSections>;
  }): Promise<{ id: string; version: number }>;
  createAnalysisRun(input: {
    tenantId: string; eventId: string; model: string; promptVersion: string;
    idempotencyKey: string; inputSha256: string;
  }): Promise<{ id: string; status: string }>;
  completeAnalysisRun(input: {
    tenantId: string; runId: string; output: unknown; insights: Awaited<ReturnType<typeof analyzeTranscript>>;
  }): Promise<void>;
  failAnalysisRun(input: { tenantId: string; runId: string; errorCode: string; errorMessage: string }): Promise<void>;
}

export async function ingestAndAnalyzeTranscript(input: {
  rawInput: unknown;
  repository: EarningsRepository;
  analyzer: TranscriptAnalyzer;
  sourceRightsVerified: boolean;
}) {
  const data = validateTranscriptInput(input.rawInput);
  if (!input.sourceRightsVerified || !data.licenseReference) {
    throw new DomainError(
      "A verified source-rights decision and license reference are required before transcript storage.",
      "SOURCE_POLICY",
      403,
    );
  }

  const event = await input.repository.findEvent({ tenantId: data.tenantId, eventId: data.eventId });
  if (!event || event.companyId !== data.companyId || event.tenantId !== data.tenantId) {
    throw new DomainError("Earnings event was not found in this tenant.", "NOT_FOUND", 404);
  }

  const contentSha256 = sha256(data.content);
  const existing = await input.repository.findTranscriptByEvent({ tenantId: data.tenantId, eventId: data.eventId });
  if (existing?.contentSha256 === contentSha256) {
    return { transcriptId: existing.id, version: existing.version, deduplicated: true, analysisRunId: null };
  }

  const sections = splitTranscriptSections(data.content);
  const transcript = await input.repository.createTranscript({
    tenantId: data.tenantId,
    eventId: data.eventId,
    sourceName: data.sourceName,
    ...(data.sourceUrl ? { sourceUrl: data.sourceUrl } : {}),
    ...(data.sourceDocumentId ? { sourceDocumentId: data.sourceDocumentId } : {}),
    ...(data.sourcePublishedAt ? { sourcePublishedAt: data.sourcePublishedAt } : {}),
    content: data.content,
    contentSha256,
    language: data.language,
    wordCount: data.content.split(/\s+/).filter(Boolean).length,
    licenseReference: data.licenseReference,
    ...(data.metadata ? { metadata: data.metadata } : {}),
    version: (existing?.version ?? 0) + 1,
    sections,
  });

  const inputSha256 = createHash("sha256").update(contentSha256 + input.analyzer.promptVersion).digest("hex");
  const idempotencyKey = createHash("sha256").update([data.tenantId, data.eventId, contentSha256, input.analyzer.promptVersion].join(":")).digest("hex");
  const run = await input.repository.createAnalysisRun({
    tenantId: data.tenantId,
    eventId: data.eventId,
    model: input.analyzer.model,
    promptVersion: input.analyzer.promptVersion,
    idempotencyKey,
    inputSha256,
  });

  try {
    const insights = await analyzeTranscript(input.analyzer, {
      ticker: event.ticker,
      fiscalYear: event.fiscalYear,
      fiscalQuarter: event.fiscalQuarter,
      transcript: data.content,
    });
    await input.repository.completeAnalysisRun({
      tenantId: data.tenantId,
      runId: run.id,
      output: { insightCount: insights.length, model: input.analyzer.model },
      insights,
    });
    return { transcriptId: transcript.id, version: transcript.version, deduplicated: false, analysisRunId: run.id };
  } catch (error) {
    await input.repository.failAnalysisRun({
      tenantId: data.tenantId,
      runId: run.id,
      errorCode: error instanceof DomainError ? error.code : "ANALYSIS_FAILED",
      errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "Unknown analysis error",
    });
    throw error;
  }
}
