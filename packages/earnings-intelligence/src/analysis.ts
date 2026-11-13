import { DomainError, InsightSchema, type Insight, type TranscriptAnalyzer } from "./types.js";

export const EARNINGS_SYSTEM_PROMPT_VERSION = "2026-10-30.1";

export function buildAnalysisInput(input: {
  ticker: string;
  fiscalYear: number;
  fiscalQuarter: number;
  transcript: string;
}) {
  return {
    ticker: input.ticker.toUpperCase(),
    fiscalYear: input.fiscalYear,
    fiscalQuarter: input.fiscalQuarter,
    transcript: input.transcript,
    instructions: [
      "Analyze only claims supported by the supplied transcript.",
      "Separate management's prepared remarks from analyst Q&A.",
      "Do not invent financial metrics, guidance, dates, or analyst identities.",
      "Every insight must include one or more exact evidence quotes and character offsets.",
      "Classify polarity as positive, negative, neutral, or mixed.",
      "Treat management projections as forward-looking statements, not established facts.",
      "Return uncertainty explicitly; never convert an absence of evidence into a negative claim.",
      "Do not provide personalized investment advice or a buy/sell recommendation.",
    ].join("\n"),
  };
}

export async function analyzeTranscript(
  analyzer: TranscriptAnalyzer,
  input: { ticker: string; fiscalYear: number; fiscalQuarter: number; transcript: string },
): Promise<Insight[]> {
  const output = await analyzer.analyze(buildAnalysisInput(input));
  if (!Array.isArray(output.insights)) {
    throw new DomainError("Analyzer returned an invalid insights payload.", "INTERNAL", 502);
  }

  const parsed = output.insights.map((item) => {
    const result = InsightSchema.safeParse(item);
    if (!result.success) {
      throw new DomainError("Analyzer returned an insight that failed schema validation.", "INTERNAL", 502);
    }
    for (const evidence of result.data.evidence) {
      const actual = input.transcript.slice(evidence.startOffset, evidence.endOffset);
      if (actual !== evidence.quote) {
        throw new DomainError("Evidence quote does not match the source transcript offsets.", "INTERNAL", 502);
      }
    }
    return result.data;
  });
  return parsed;
}
