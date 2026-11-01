import test from "node:test";
import assert from "node:assert/strict";
import { createLicensedSabrientScorecard } from "../dist/connectors/sabrient-scorecard.js";

test("imports a licensed scorecard and preserves its license reference", () => {
  const result = createLicensedSabrientScorecard({
    csv: 'Ticker,Rank,Style\nAAPL,92,GARP\nMSFT,89,GARP',
    scorecardName: "GARP Top 50",
    asOfDate: "2026-11-01",
    licenseReference: "contract-123",
    permittedUse: "internal_analysis",
  });
  assert.equal(result.contentMode, "FULL_TEXT");
  assert.equal(result.rightsReference, "contract-123");
  assert.equal(result.metadata.rows, 2);
});

test("rejects a scorecard without an explicit license reference", () => {
  assert.throws(() => createLicensedSabrientScorecard({
    csv: "Ticker,Rank\nAAPL,92",
    scorecardName: "GARP",
    asOfDate: "2026-11-01",
    licenseReference: "",
    permittedUse: "internal_analysis",
  }));
});

test("rejects malformed row widths", () => {
  assert.throws(() => createLicensedSabrientScorecard({
    csv: "Ticker,Rank\nAAPL,92,extra",
    scorecardName: "GARP",
    asOfDate: "2026-11-01",
    licenseReference: "contract-123",
    permittedUse: "internal_analysis",
  }));
});
