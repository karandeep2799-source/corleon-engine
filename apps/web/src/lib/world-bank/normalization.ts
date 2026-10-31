export type JsonRecord = Record<string, unknown>;

export function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

export function firstString(
  record: JsonRecord,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

export function normalizeDataset(value: unknown) {
  const record = asRecord(value);
  const uniqueId = firstString(record, [
    "dataset_unique_id",
    "unique_id",
    "dataset_id",
    "id",
  ]);
  const title = firstString(record, [
    "dataset_title",
    "title",
    "name",
    "dataset_name",
  ]);

  if (!uniqueId || !title) return null;

  return {
    uniqueId,
    title,
    description: firstString(record, [
      "dataset_description",
      "description",
      "abstract",
    ]),
    version: firstString(record, ["version", "version_id", "dataset_version"]),
    sourceUrl: firstString(record, ["url", "dataset_url", "source_url"]),
    metadata: record,
  };
}

export function normalizeList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  for (const key of ["data", "results", "datasets", "items", "value"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}
