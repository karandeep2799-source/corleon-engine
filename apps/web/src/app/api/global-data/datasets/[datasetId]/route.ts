import { jsonError, worldBankGet } from "@/lib/world-bank/client";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ datasetId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { datasetId } = await context.params;
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(datasetId)) {
    return Response.json({ error: "invalid_dataset_id" }, { status: 400 });
  }

  try {
    const [datasetResult, resourcesResult, indicatorsResult, citationsResult] =
      await Promise.allSettled([
        worldBankGet<unknown>(\`/datasets/\${encodeURIComponent(datasetId)}\`),
        worldBankGet<unknown>("/resources", { dataset_unique_id: datasetId, top: 100, skip: 0 }),
        worldBankGet<unknown>("/indicators", { dataset_unique_id: datasetId, top: 100, skip: 0 }),
        worldBankGet<unknown>("/citations", { dataset_unique_id: datasetId, top: 100, skip: 0 }),
      ]);

    if (datasetResult.status === "rejected") throw datasetResult.reason;

    const optional = (result: PromiseSettledResult<unknown>) =>
      result.status === "fulfilled" ? result.value : [];

    return Response.json(
      {
        dataset: datasetResult.value,
        resources: optional(resourcesResult),
        indicators: optional(indicatorsResult),
        citations: optional(citationsResult),
        partial: [resourcesResult, indicatorsResult, citationsResult].some(
          (result) => result.status === "rejected",
        ),
        source: "World Bank Data Catalog",
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
