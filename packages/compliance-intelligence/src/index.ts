/**
 * Corleon Compliance Intelligence.
 * Deterministic license-evidence and attribution helpers; not legal advice.
 * This package does not infer licenses from a domain or make network requests.
 */
export type MaterialKind = "documentation" | "code-sample" | "brand-feature" | "image" | "audio" | "video" | "third-party-link" | "other";
export type LicenseId = "CC-BY-4.0" | "Apache-2.0" | "Google-brand-guidelines" | "third-party-review-required" | "unknown";

export interface SourceRecord {
  id: string;
  title: string;
  sourceUrl: string;
  publisher: string;
  materialKind: MaterialKind;
  license: LicenseId;
  licenseEvidence: string;
  reviewed: boolean;
  attributionRequired?: boolean;
  reviewedOn?: string;
  notes?: string;
}
export interface ValidationIssue { path: string; message: string }
export interface Manifest { version: 1; sources: SourceRecord[] }

const kinds = new Set<MaterialKind>(["documentation", "code-sample", "brand-feature", "image", "audio", "video", "third-party-link", "other"]);
const licenses = new Set<LicenseId>(["CC-BY-4.0", "Apache-2.0", "Google-brand-guidelines", "third-party-review-required", "unknown"]);

export function validateSourceRecord(record: SourceRecord): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const key of ["id", "title", "sourceUrl", "publisher", "licenseEvidence"] as const) {
    if (typeof record[key] !== "string" || !record[key].trim()) issues.push({ path: key, message: "Required non-empty string." });
  }
  try {
    if (new URL(record.sourceUrl).protocol !== "https:") issues.push({ path: "sourceUrl", message: "Source URLs must use HTTPS." });
  } catch { issues.push({ path: "sourceUrl", message: "Must be an absolute URL." }); }
  if (!kinds.has(record.materialKind)) issues.push({ path: "materialKind", message: "Unsupported material kind." });
  if (!licenses.has(record.license)) issues.push({ path: "license", message: "Unsupported license identifier." });
  if (record.license === "CC-BY-4.0" && record.attributionRequired === false) issues.push({ path: "attributionRequired", message: "CC BY 4.0 requires attribution." });
  if (record.materialKind === "brand-feature" && record.license === "CC-BY-4.0") issues.push({ path: "license", message: "Google brand features are excluded from the documentation license." });
  if (record.reviewedOn && !/^\\d{4}-\\d{2}-\\d{2}$/.test(record.reviewedOn)) issues.push({ path: "reviewedOn", message: "Must use YYYY-MM-DD." });
  return issues;
}

export function validateManifest(manifest: Manifest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (manifest.version !== 1) issues.push({ path: "version", message: "Unsupported manifest version." });
  if (!Array.isArray(manifest.sources)) return [...issues, { path: "sources", message: "Must be an array." }];
  const ids = new Set<string>();
  manifest.sources.forEach((source, index) => {
    for (const issue of validateSourceRecord(source)) issues.push({ path: "sources[" + index + "]." + issue.path, message: issue.message });
    if (ids.has(source.id)) issues.push({ path: "sources[" + index + "].id", message: "Duplicate source id." });
    ids.add(source.id);
  });
  return issues;
}

export function detectGooglePageLicenses(pageText: string): { documentation: "CC-BY-4.0" | "unknown"; codeSamples: "Apache-2.0" | "unknown"; evidence: string[] } {
  const cc = /Creative Commons Attribution 4\\.0 License/i.test(pageText) || /creativecommons\\.org\\/licenses\\/by\\/4\\.0/i.test(pageText);
  const apache = /code samples are licensed under the Apache 2\\.0 License/i.test(pageText) || /apache\\.org\\/licenses\\/LICENSE-2\\.0/i.test(pageText);
  const evidence: string[] = [];
  if (cc) evidence.push("Page notice identifies Creative Commons Attribution 4.0.");
  if (apache) evidence.push("Page notice identifies Apache 2.0 for code samples.");
  return { documentation: cc ? "CC-BY-4.0" : "unknown", codeSamples: apache ? "Apache-2.0" : "unknown", evidence };
}

export function formatGoogleAttribution(sourceUrl: string, mode: "reproduced" | "modified"): string {
  const url = new URL(sourceUrl);
  if (url.protocol !== "https:") throw new Error("Attribution source URL must use HTTPS.");
  const lead = mode === "reproduced" ? "Portions of this page are reproduced from work created and " : "Portions of this page are modifications based on work created and ";
  return lead + "[shared by Google](https://developers.google.com/readme/policies) and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/).\n\n[Original source](" + url.toString() + ")";
}

export function isReleaseBlocked(manifest: Manifest): boolean {
  return manifest.sources.some((source) => !source.reviewed || source.license === "unknown" || source.license === "third-party-review-required" || validateSourceRecord(source).length > 0);
}
