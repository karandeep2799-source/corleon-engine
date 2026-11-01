export interface RetrievedKnowledge {
  id: string;
  title: string;
  canonicalUrl?: string;
  excerpt: string;
  sourceName: string;
  sourceKind: string;
  publishedAt?: Date;
  fetchedAt: Date;
  contentMode: "METADATA_ONLY" | "FULL_TEXT";
  rightsReference?: string;
  score: number;
}

export interface KnowledgeSearchRepository {
  search(input: {
    tenantId: string;
    query: string;
    limit: number;
    allowedSourceIds?: string[];
    asOf?: Date;
  }): Promise<RetrievedKnowledge[]>;
}

export async function searchKnowledge(
  repository: KnowledgeSearchRepository,
  input: { tenantId: string; query: string; limit?: number; allowedSourceIds?: string[]; asOf?: Date },
): Promise<RetrievedKnowledge[]> {
  if (!input.tenantId.trim()) throw new Error("Authenticated tenant is required.");
  const query = input.query.trim();
  if (query.length < 2 || query.length > 2_000) throw new Error("Query must be between 2 and 2,000 characters.");
  const limit = Math.min(Math.max(input.limit ?? 8, 1), 25);
  const results = await repository.search({
    tenantId: input.tenantId,
    query,
    limit,
    ...(input.allowedSourceIds ? { allowedSourceIds: input.allowedSourceIds } : {}),
    ...(input.asOf ? { asOf: input.asOf } : {}),
  });
  return results.filter((item) => item.id && item.title && item.sourceName && Number.isFinite(item.score));
}
