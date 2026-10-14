import { z } from "zod";
import type { Point } from "./types";

const optionalAmount = z.number().finite().min(0).max(1e9).nullable();
export const siteSchema = z.object({
  status: z.enum(["unknown", "available", "occupied"]),
  source: z.string().trim().max(250), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const d = new Date(value + "T00:00:00Z"); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value; }, "Fecha inválida").or(z.literal("")),
  householdIncome: optionalAmount, population: optionalAmount, footfall: optionalAmount,
  ticket: optionalAmount, customers: optionalAmount, days: z.number().int().min(1).max(31).nullable(),
  notes: z.string().max(500),
}).superRefine((site, ctx) => {
  if ((site.status !== "unknown" || site.householdIncome !== null || site.population !== null || site.footfall !== null) && (!site.source || !site.date))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Indica fuente y fecha para los datos reportados y la disponibilidad." });
});
export type Site = z.infer<typeof siteSchema>;
export const emptySite: Site = { status: "unknown", source: "", date: "", householdIncome: null, population: null, footfall: null, ticket: null, customers: null, days: null, notes: "" };
export const SITE_STORAGE = "geobusiness.sites.v1";
export const sitesSchema = z.object({ version: z.literal(1), sites: z.record(siteSchema).refine(sites => Object.keys(sites).length <= 50, "Hasta 50 lugares por navegador.") });
export function siteKey(p: Point): string { return `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`; }
export function grossRevenue(site: Site): number | null {
  if (site.ticket === null || site.customers === null || site.days === null) return null;
  if (![site.ticket, site.customers, site.days].every(n => Number.isFinite(n) && n >= 0) || !Number.isInteger(site.days) || site.days < 1 || site.days > 31) return null;
  return site.ticket * site.customers * site.days;
}
