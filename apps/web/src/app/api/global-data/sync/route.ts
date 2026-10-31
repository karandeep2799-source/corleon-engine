import { timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { jsonError, worldBankGet } from "@/lib/world-bank/client";
import { normalizeDataset, normalizeList } from "@/lib/world-bank/normalization";
import { worldBankPrisma } from "@/lib/world-bank/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const job = await worldBankPrisma.worldBankSyncJob.create({
    data: { status: "RUNNING", startedAt: new Date() },
  });

  try {
    const payload = await worldBankGet<unknown>("/datasets/recent");
    const records = normalizeList(payload);
    let upserted = 0;

    for (const item of records) {
      const dataset = normalizeDataset(item);
      if (!dataset) continue;

      await worldBankPrisma.worldBankDataset.upsert({
        where: { uniqueId: dataset.uniqueId },
        create: {
          uniqueId: dataset.uniqueId,
          title: dataset.title,
          description: dataset.description,
          version: dataset.version,
          sourceUrl: dataset.sourceUrl,
          metadata: dataset.metadata as Prisma.InputJsonValue,
          syncedAt: new Date(),
        },
        update: {
          title: dataset.title,
          description: dataset.description,
          version: dataset.version,
          sourceUrl: dataset.sourceUrl,
          metadata: dataset.metadata as Prisma.InputJsonValue,
          syncedAt: new Date(),
        },
      });
      upserted += 1;
    }

    await worldBankPrisma.worldBankSyncJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCEEDED",
        completedAt: new Date(),
        recordsSeen: records.length,
        recordsUpserted: upserted,
      },
    });

    return Response.json({
      jobId: job.id,
      status: "SUCCEEDED",
      recordsSeen: records.length,
      recordsUpserted: upserted,
    });
  } catch (error) {
    await worldBankPrisma.worldBankSyncJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
      },
    });
    return jsonError(error);
  }
}
