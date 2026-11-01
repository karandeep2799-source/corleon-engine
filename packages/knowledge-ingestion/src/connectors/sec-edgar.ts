export interface SecFilingMetadata {
  externalId: string;
  title: string;
  canonicalUrl: string;
  publishedAt?: Date;
  content: string;
  contentMode: "METADATA_ONLY";
  metadata: Record<string, unknown>;
}

interface SecSubmissions {
  name?: string;
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      form?: string[];
      primaryDocument?: string[];
      primaryDocDescription?: string[];
    };
  };
}

export async function fetchSecRecentFilings(input: {
  cik: string;
  userAgent: string;
  forms?: string[];
  limit?: number;
  fetchImpl?: typeof fetch;
}): Promise<SecFilingMetadata[]> {
  if (!/^[0-9]{1,10}$/.test(input.cik)) throw new Error("CIK must contain 1 to 10 digits.");
  if (!input.userAgent.includes("@")) throw new Error("SEC User-Agent must include a contact email.");
  const cik = input.cik.padStart(10, "0");
  const response = await (input.fetchImpl ?? fetch)(`https://data.sec.gov/submissions/CIK${cik}.json`, {
    headers: { "user-agent": input.userAgent, accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`SEC submissions endpoint returned HTTP ${response.status}.`);
  const data = await response.json() as SecSubmissions;
  const recent = data.filings?.recent;
  if (!recent) return [];
  const forms = input.forms ? new Set(input.forms) : undefined;
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 100);
  const results: SecFilingMetadata[] = [];
  const count = recent.accessionNumber?.length ?? 0;
  for (let i = 0; i < count && results.length < limit; i++) {
    const form = recent.form?.[i] ?? "";
    const accession = recent.accessionNumber?.[i] ?? "";
    const date = recent.filingDate?.[i] ?? "";
    const primary = recent.primaryDocument?.[i] ?? "";
    if (!form || !accession || !date || !primary || (forms && !forms.has(form))) continue;
    const accessionPath = accession.replace(/-/g, "");
    const cikPath = String(Number(input.cik));
    const canonicalUrl = `https://www.sec.gov/Archives/edgar/data/${cikPath}/${accessionPath}/${encodeURIComponent(primary)}`;
    results.push({
      externalId: accession,
      title: `${data.name ?? "Issuer"} — ${form} filing`,
      canonicalUrl,
      publishedAt: new Date(`${date}T00:00:00.000Z`),
      content: `${form} filing ${accession} filed ${date}`,
      contentMode: "METADATA_ONLY",
      metadata: { cik, form, accessionNumber: accession, filingDate: date, primaryDocument: primary, description: recent.primaryDocDescription?.[i] ?? "" },
    });
  }
  return results;
}
