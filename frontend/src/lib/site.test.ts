import { expect, it } from "vitest";
import { emptySite, grossRevenue, siteKey, siteSchema } from "./site";
it("requires evidence for availability, income and reported audience", () => {
  expect(siteSchema.safeParse(emptySite).success).toBe(true);
  expect(siteSchema.safeParse({ ...emptySite, status: "available" }).success).toBe(false);
  expect(siteSchema.safeParse({ ...emptySite, householdIncome: 0 }).success).toBe(false);
  expect(siteSchema.safeParse({ ...emptySite, status: "available", source: "Propietario", date: "2026-10-14" }).success).toBe(true);
});
it("keeps missing values distinct from explicit zero and calculates only a scenario", () => {
  expect(grossRevenue(emptySite)).toBeNull();
  expect(grossRevenue({ ...emptySite, ticket: 20, customers: 30, days: 26 })).toBe(15600);
  expect(grossRevenue({ ...emptySite, ticket: 20, customers: 0, days: 26 })).toBe(0);
  expect(grossRevenue({ ...emptySite, ticket: -1, customers: 30, days: 26 })).toBeNull();
});
it("uses a distinct location key at six decimals", () => {
  expect(siteKey({ lat: -12.1211, lng: -77.03 })).toBe("-12.121100,-77.030000");
  expect(siteKey({ lat: -12.121101, lng: -77.03 })).not.toBe(siteKey({ lat: -12.1211, lng: -77.03 }));
});
