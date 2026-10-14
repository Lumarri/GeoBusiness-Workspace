import { describe, expect, it } from "vitest";
import { filterBusinesses } from "./businesses";
import { businessSchema, nearbySchema, type Business } from "./types";

const business: Business = {
  osm_id: "node/1", osm_type: "node", name: "Café de prueba", category: "food",
  category_label: "Restaurantes y cafés", subtype: "cafe", lat: -12.1, lng: -77,
  distance_m: 12, location_method: "node", address: "Calle de prueba", opening_hours: null,
  osm_url: "https://www.openstreetmap.org/node/1", evidence: "osm_record",
};

describe("business filters and contract", () => {
  it("searches without accents, applies categories, and preserves the input", () => {
    expect(filterBusinesses([business], "all", " CAFE ")).toEqual([business]);
    expect(filterBusinesses([business], "food", "calle")).toEqual([business]);
    expect(filterBusinesses([business], "health", "")).toEqual([]);
    expect(business.name).toBe("Café de prueba");
  });
  it("rejects non-OSM source links and incorrect evidence", () => {
    expect(businessSchema.safeParse({ ...business, osm_url: "https://example.com" }).success).toBe(false);
    expect(businessSchema.safeParse({ ...business, evidence: "estimated" }).success).toBe(false);
  });
  it("rejects malformed API responses before rendering", () => {
    expect(nearbySchema.safeParse({ businesses: [business], total_in_radius: "four" }).success).toBe(false);
  });
});

