import { z } from "zod";

export const categorySchema = z.enum(["food", "groceries", "health", "retail", "services", "other"]);
export type Category = z.infer<typeof categorySchema>;
export type Radius = 250 | 500 | 1000;
export type Point = { lat: number; lng: number };

export const businessSchema = z.object({
  osm_id: z.string(), osm_type: z.enum(["node", "way", "relation"]), name: z.string(),
  category: categorySchema, category_label: z.string(), subtype: z.string(),
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), distance_m: z.number().nonnegative(),
  location_method: z.enum(["node", "bounding_box_center"]), address: z.string().nullable(),
  opening_hours: z.string().nullable(), osm_url: z.string().url().refine(url => url.startsWith("https://www.openstreetmap.org/")),
  evidence: z.literal("osm_record"),
});
export type Business = z.infer<typeof businessSchema>;

export const nearbySchema = z.object({
  location: z.object({ lat: z.number(), lng: z.number() }), radius_m: z.union([z.literal(250), z.literal(500), z.literal(1000)]),
  region: z.string(), total_in_radius: z.number().int().nonnegative(), total_filtered: z.number().int().nonnegative(),
  categories: z.array(z.object({ category: categorySchema, label: z.string(), count: z.number().int().nonnegative() })),
  businesses: z.array(businessSchema),
  source: z.object({
    provider: z.literal("OpenStreetMap / Overpass"), license: z.literal("ODbL-1.0"),
    retrieved_at: z.string().datetime({ offset: true }), osm_base_timestamp: z.string().nullable(),
    cache_hit: z.boolean(), cache_expires_at: z.string().datetime({ offset: true }),
    distance_method: z.literal("haversine_straight_line"), limitations: z.array(z.string()),
  }),
});
export type NearbyResult = z.infer<typeof nearbySchema>;
export const regionSchema = z.object({
  region: z.string(), bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  radii_m: z.array(z.number()), categories: z.array(z.object({ id: categorySchema, label: z.string() })),
});
export type Region = z.infer<typeof regionSchema>;

