import { describe, expect, it } from "vitest";
import { canCompare, readAnalyses, writeAnalyses, type SavedAnalysis } from "./analyses";

function analysis(id: string, radius: 250 | 500 = 250): SavedAnalysis {
  return { id, name: id, savedAt: "2026-10-14T12:00:00Z", result: {
    location: { lat: -12.12, lng: -77.03 }, radius_m: radius, region: "Lima",
    total_in_radius: 0, total_filtered: 0, categories: [], businesses: [],
    source: { provider: "OpenStreetMap / Overpass", license: "ODbL-1.0", retrieved_at: "2026-10-14T12:00:00Z", osm_base_timestamp: null, cache_hit: false, cache_expires_at: "2026-10-15T12:00:00Z", distance_method: "haversine_straight_line", limitations: [] },
  } };
}
describe("saved analyses", () => {
  it("roundtrips evidence and snapshots", () => { const a = analysis("local"); expect(readAnalyses(writeAnalyses([a]))).toEqual([a]); });
  it("rejects corrupt or incompatible storage instead of silently losing it", () => {
    expect(readAnalyses(null)).toEqual([]);
    expect(() => readAnalyses("bad")).toThrow();
    expect(() => readAnalyses('{"version":2,"analyses":[]}')).toThrow();
    expect(() => writeAnalyses(Array.from({ length: 11 }, (_, i) => analysis(String(i))))).toThrow();
  });
  it("requires two or three analyses with the same radius and region", () => {
    expect(canCompare([analysis("a")])).toBe(false);
    expect(canCompare([analysis("a"), analysis("b")])).toBe(true);
    expect(canCompare([analysis("a"), analysis("b", 500)])).toBe(false);
    const other = analysis("other"); other.result.region = "Otra ciudad";
    expect(canCompare([analysis("a"), other])).toBe(false);
  });
});
