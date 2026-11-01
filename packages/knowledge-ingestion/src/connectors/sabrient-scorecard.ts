export interface SabrientScorecardDocument {
  externalId: string;
  title: string;
  content: string;
  contentMode: "FULL_TEXT";
  rightsReference: string;
  metadata: Record<string, unknown>;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  values.push(current.trim());
  return values;
}

/**
 * Imports a scorecard already obtained under an applicable Sabrient license.
 * This adapter does not download, scrape, or discover proprietary scorecards.
 */
export function createLicensedSabrientScorecard(input: {
  csv: string;
  scorecardName: string;
  asOfDate: string;
  licenseReference: string;
  permittedUse: "internal_analysis";
}): SabrientScorecardDocument {
  if (!input.licenseReference.trim()) throw new Error("A Sabrient license reference is required.");
  if (input.permittedUse !== "internal_analysis") throw new Error("Only explicitly licensed internal analysis is supported.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.asOfDate) || Number.isNaN(Date.parse(input.asOfDate))) {
    throw new Error("asOfDate must be a valid YYYY-MM-DD date.");
  }
  if (input.csv.length === 0 || input.csv.length > 5_000_000) throw new Error("Scorecard CSV must be between 1 byte and 5 MB.");
  const lines = input.csv.replace(/\r\n?/g, "\n").split("\n").filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Scorecard CSV must contain a header and at least one data row.");
  const header = parseCsvLine(lines[0]!);
  if (header.length < 2 || header.some((cell) => !cell)) throw new Error("Scorecard CSV header is invalid.");
  const rows = lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    if (values.length !== header.length) throw new Error(`CSV row ${index + 2} has ${values.length} columns; expected ${header.length}.`);
    return values;
  });
  const normalized = [header, ...rows].map((row) => row.map((cell) => JSON.stringify(cell)).join(",")).join("\n");
  return {
    externalId: `sabrient:${input.scorecardName}:${input.asOfDate}`,
    title: `Sabrient scorecard — ${input.scorecardName} — ${input.asOfDate}`,
    content: normalized,
    contentMode: "FULL_TEXT",
    rightsReference: input.licenseReference,
    metadata: {
      provider: "Sabrient",
      scorecardName: input.scorecardName,
      asOfDate: input.asOfDate,
      rows: rows.length,
      columns: header,
      permittedUse: input.permittedUse,
    },
  };
}
