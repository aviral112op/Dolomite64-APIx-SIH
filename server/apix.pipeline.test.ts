import { describe, expect, it } from "vitest";
import { deduplicateQuotes, markRobustOutliers, normalizeRemoteQuotes } from "./apix";

describe("APIx fare pipeline", () => {
  const valid = {
    origin: "DEL",
    destination: "BOM",
    travelDate: "2026-09-15",
    leadDays: 7,
    carrier: "IndiGo",
    baseFare: 5000,
    taxes: 900,
    udf: 120,
    mandatoryCharges: 99,
    optionalCharges: 0,
    totalFare: 6119,
  };

  it("normalizes snake_case source fields into APIx fare components", () => {
    const [quote] = normalizeRemoteQuotes("licensed_source", [{ ...valid, base_fare: valid.baseFare, total_fare: valid.totalFare, source_quote_id: "q-1" }]);
    expect(quote).toMatchObject({ sourceId: "licensed_source", sourceQuoteId: "q-1", baseFare: 5000, totalFare: 6119 });
  });

  it("removes invalid, unavailable, non-window, and duplicate quotes", () => {
    const quotes = normalizeRemoteQuotes("fixture", [
      { ...valid, sourceQuoteId: "q-1" },
      { ...valid, sourceQuoteId: "q-1" },
      { ...valid, sourceQuoteId: "sold", availabilityStatus: "sold_out" },
      { ...valid, sourceQuoteId: "bad-window", leadDays: 3 },
    ]);
    expect(deduplicateQuotes(quotes)).toHaveLength(1);
  });

  it("flags extreme fare deviations without deleting the observations", () => {
    const quotes = Array.from({ length: 6 }, (_, index) => ({ ...valid, sourceQuoteId: `q-${index}`, totalFare: index === 5 ? 30000 : 6119 + index * 4 }));
    const result = markRobustOutliers(quotes);
    expect(result).toHaveLength(6);
    expect(result.find((row) => row.quote.sourceQuoteId === "q-5")?.outlierCandidate).toBe(true);
  });
});
