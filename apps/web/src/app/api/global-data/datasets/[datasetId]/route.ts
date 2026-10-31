import { jsonError, worldBankGet } from "@/lib/world-bank/client";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ datasetId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { datasetId } = await context.params;
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(datasetId)) {
    return Response.json({ error: "invalid_dataset_id" }, { status: 400 });
  }

  try {
    const [dataset, resources, indicators, citations] = await Promise.all([
      worldBankGet<unknown>(\`/datasets/\${encodeURIComponent(datasetId)}\`),
      worldBankGet<unknown>("/resources", { dataset_unique_id: datasetId, top: 100, skip: 0 }),
      worldBankGet<unknown>("/indicators", { dataset_unique_id: datasetId, top: 100, skip: 0 }),
      worldBankGet<unknown>("/citations", { dataset_unique_id: datasetId, top: 100, skip: 0 }),
    ]);

    return Response.json(
      { dataset, resources, indicators, citations, source: "World Bank Data Catalog" },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
