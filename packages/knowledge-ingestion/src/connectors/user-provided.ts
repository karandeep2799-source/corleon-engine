import { z } from "zod";

const UserDocumentSchema = z.object({
  externalId: z.string().min(1).max(512),
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(8_000_000),
  rightsReference: z.string().min(1).max(512),
  canonicalUrl: z.string().url().optional(),
  publishedAt: z.coerce.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export function createUserProvidedDocument(raw: unknown) {
  const parsed = UserDocumentSchema.parse(raw);
  return {
    ...parsed,
    contentMode: "FULL_TEXT" as const,
    metadata: { ...parsed.metadata, ingestionMethod: "user-provided" },
  };
}
