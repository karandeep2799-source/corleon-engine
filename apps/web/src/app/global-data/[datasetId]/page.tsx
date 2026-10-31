"use client";

import { useEffect, useState } from "react";

type Payload = {
  dataset?: unknown;
  resources?: unknown;
  indicators?: unknown;
  citations?: unknown;
};

function rows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    for (const key of ["data", "results", "items", "value"]) {
      if (Array.isArray(object[key])) return object[key] as Record<string, unknown>[];
    }
  }
  return [];
}

function text(value: unknown, keys: string[]): string {
  if (!value || typeof value !== "object") return "Dataset details";
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (typeof record[key] === "string" && record[key]) return record[key] as string;
  }
  return "Dataset details";
}

export default function DatasetDetailPage({ params }: { params: Promise<{ datasetId: string }> }) {
  const [datasetId, setDatasetId] = useState("");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void params.then(({ datasetId: id }) => {
      if (!active) return;
      setDatasetId(id);
      return fetch(\`/api/global-data/datasets/\${encodeURIComponent(id)}\`)
        .then(async (response) => {
          if (!response.ok) throw new Error("Unable to retrieve this dataset.");
          return (await response.json()) as Payload;
        })
        .then((data) => { if (active) setPayload(data); })
        .catch((cause: unknown) => {
          if (active) setError(cause instanceof Error ? cause.message : "Request failed.");
        });
    });
    return () => { active = false; };
  }, [params]);

  const dataset = payload?.dataset;
  const resources = rows(payload?.resources);
  const indicators = rows(payload?.indicators);
  const citations = rows(payload?.citations);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <a href="/global-data" className="text-sm text-blue-600 hover:underline">← Back to explorer</a>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-blue-500">World Bank dataset</p>
      <h1 className="mt-3 text-3xl font-semibold">{text(dataset, ["dataset_title", "title", "name"])}</h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">Dataset ID: {datasetId}</p>
      {error && <p role="alert" className="mt-6 rounded-lg border border-red-500/30 p-4 text-red-600">{error}</p>}
      {!payload && !error && <p className="mt-8 text-sm text-[var(--muted-foreground)]">Loading dataset metadata…</p>}
      {payload && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[var(--border)] p-5">
            <h2 className="font-semibold">Overview</h2>
            <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-[var(--muted-foreground)]">
              {JSON.stringify(dataset, null, 2)}
            </pre>
          </section>
          <section className="space-y-5">
            {[
              ["Resources", resources],
              ["Indicators", indicators],
              ["Citations", citations],
            ].map(([heading, records]) => (
              <div key={heading as string} className="rounded-2xl border border-[var(--border)] p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{heading as string}</h2>
                  <span className="text-xs text-[var(--muted-foreground)]">{(records as unknown[]).length}</span>
                </div>
                <ul className="mt-3 space-y-3">
                  {(records as Record<string, unknown>[]).slice(0, 12).map((record, index) => (
                    <li key={String(record.resource_unique_id ?? record.indicator_unique_id ?? record.citation_unique_id ?? index)} className="border-t border-[var(--border)] pt-3 text-sm">
                      <p className="font-medium">{text(record, ["title", "resource_title", "indicator_name", "name"])}</p>
                      <p className="mt-1 break-words text-xs text-[var(--muted-foreground)]">
                        {text(record, ["description", "resource_description", "year", "url"])}
                      </p>
                    </li>
                  ))}
                  {(records as unknown[]).length === 0 && (
                    <li className="text-sm text-[var(--muted-foreground)]">No records returned.</li>
                  )}
                </ul>
              </div>
            ))}
          </section>
        </div>
      )}
    </main>
  );
}
