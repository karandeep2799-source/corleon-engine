"use client";

import { useCallback, useEffect, useState } from "react";

type Dataset = Record<string, unknown>;

function getText(item: Dataset, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "Untitled dataset";
}

function getId(item: Dataset): string {
  return getText(item, ["dataset_unique_id", "unique_id", "dataset_id", "id"]);
}

function getRows(payload: unknown): Dataset[] {
  if (Array.isArray(payload)) return payload as Dataset[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["data", "results", "datasets", "items", "value"]) {
    if (Array.isArray(record[key])) return record[key] as Dataset[];
  }
  return [];
}

export default function GlobalDataPage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const load = useCallback(async (term?: string) => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = term
        ? \`/api/global-data/search?q=\${encodeURIComponent(term)}&top=30\`
        : "/api/global-data/datasets?top=30";
      const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("World Bank data is temporarily unavailable.");
      const payload: unknown = await response.json();
      setItems(getRows(payload));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load datasets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (term.length < 2) {
      setError("Enter at least two characters to search.");
      return;
    }
    setSearched(true);
    await load(term);
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-10 text-[var(--foreground)]">
      <div className="mb-10 flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-500">
            Corleon Intelligence
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Global Data Explorer</h1>
          <p className="mt-3 max-w-2xl text-sm text-[var(--muted-foreground)]">
            Discover development datasets, inspect their metadata and build evidence-led
            country and economic research from the World Bank Data Catalog.
          </p>
        </div>
        <a
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--accent)]"
          href="https://datacatalog.worldbank.org/"
          target="_blank"
          rel="noreferrer"
        >
          Open World Bank Catalog ↗
        </a>
      </div>

      <form onSubmit={submit} className="mb-8 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="dataset-search">Search datasets</label>
        <input
          id="dataset-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search climate, poverty, trade, health, education..."
          className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-blue-600 px-6 py-3 font-medium text-white disabled:opacity-50"
        >
          Search catalog
        </button>
        {searched && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSearched(false);
              void load();
            }}
            className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
          >
            Clear
          </button>
        )}
      </form>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{searched ? "Search results" : "Catalog datasets"}</h2>
        <span className="text-sm text-[var(--muted-foreground)]">
          {loading ? "Loading…" : \`\${items.length} records\`}
        </span>
      </div>

      {error && (
        <div role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--accent)]" />
          ))}
        </div>
      ) : items.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => {
            const id = getId(item);
            const title = getText(item, ["dataset_title", "title", "name", "dataset_name"]);
            const description = getText(item, ["dataset_description", "description", "abstract"]);
            return (
              <article key={id || index} className="flex min-h-44 flex-col rounded-2xl border border-[var(--border)] p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-600">
                    World Bank dataset
                  </span>
                  {id !== "Untitled dataset" && (
                    <span className="max-w-36 truncate text-xs text-[var(--muted-foreground)]">{id}</span>
                  )}
                </div>
                <h3 className="font-semibold leading-snug">{title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--muted-foreground)]">
                  {description === "Untitled dataset" ? "Open the dataset to inspect its metadata, resources and citations." : description}
                </p>
                <div className="mt-auto pt-4">
                  <a
                    href={id !== "Untitled dataset" ? \`/global-data/\${encodeURIComponent(id)}\` : "https://datacatalog.worldbank.org/"}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    Explore dataset →
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted-foreground)]">
          {error ? "Try again in a moment." : "No datasets found. Try another search term."}
        </div>
      )}

      <footer className="mt-12 border-t border-[var(--border)] pt-5 text-xs text-[var(--muted-foreground)]">
        Data and metadata are supplied by the World Bank. Verify each dataset's license,
        coverage, version and citation before redistribution or commercial use.
      </footer>
    </main>
  );
}
