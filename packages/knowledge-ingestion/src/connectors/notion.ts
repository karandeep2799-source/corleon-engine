import { z } from "zod";

const NotionPagePayloadSchema = z.object({
  pageId: z.string().min(1).max(128),
  workspaceId: z.string().min(1).max(128),
  title: z.string().min(1).max(500),
  url: z.string().url(),
  lastEditedTime: z.coerce.date().optional(),
  blocks: z.array(z.object({
    type: z.string().min(1).max(80),
    text: z.string().max(100_000),
  })).max(10_000),
  rightsReference: z.string().min(1).max(512),
});

export function createNotionPageDocument(raw: unknown) {
  const page = NotionPagePayloadSchema.parse(raw);
  const content = page.blocks
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join("\n\n");
  if (!content) throw new Error("Notion page contains no readable text blocks.");
  return {
    externalId: page.pageId,
    title: page.title,
    canonicalUrl: page.url,
    content,
    contentMode: "FULL_TEXT" as const,
    rightsReference: page.rightsReference,
    ...(page.lastEditedTime ? { publishedAt: page.lastEditedTime } : {}),
    metadata: {
      provider: "notion",
      workspaceId: page.workspaceId,
      pageId: page.pageId,
      lastEditedTime: page.lastEditedTime?.toISOString(),
      blockCount: page.blocks.length,
    },
  };
}
