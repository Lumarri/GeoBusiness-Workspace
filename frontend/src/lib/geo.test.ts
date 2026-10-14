import { describe, expect, it } from "vitest";
import { radiusPolygon, withinRegion } from "./geo";

describe("analysis geometry", () => {
  it("creates a closed geodesic ring at the intended radius with longitude-first coordinates", () => {
    const polygon = radiusPolygon({ lat: 0, lng: 0 }, 500);
    const ring = polygon.geometry.coordinates[0];
    expect(ring).toHaveLength(97);
    expect(ring[0]).toEqual(ring[96]);
    expect(ring[0][0]).toBeCloseTo(0, 8);
    expect(ring[0][1] * Math.PI / 180 * 6_371_008.8).toBeCloseTo(500, 5);
    expect(ring[24][0]).toBeGreaterThan(0);
  });
  it("validates finite coordinates and the configured region", () => {
    const bbox: [number, number, number, number] = [-77.25, -12.4, -76.65, -11.65];
    expect(withinRegion({ lat: -12.1, lng: -77 }, bbox)).toBe(true);
    expect(withinRegion({ lat: 0, lng: 0 }, bbox)).toBe(false);
    expect(withinRegion({ lat: NaN, lng: -77 }, bbox)).toBe(false);
  });
});


import { offsetPoint } from "./geo";
it("nudges a location east by approximately one meter without invalid coordinates", () => {
  const p = offsetPoint({ lat: -12.12, lng: -77.03 }, 90);
  expect(p.lng).toBeGreaterThan(-77.03);
  expect(p.lat).toBeCloseTo(-12.12, 8);
  const pole = offsetPoint({ lat: 90, lng: 180 }, 0);
  expect(Number.isFinite(pole.lat) && Number.isFinite(pole.lng)).toBe(true);
  expect(pole.lat).toBeLessThanOrEqual(90);
});
