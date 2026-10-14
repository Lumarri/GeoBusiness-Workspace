import type { Business, Category } from "./types";

export function normalizeSearch(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

export function filterBusinesses(records: Business[], category: Category | "all", search: string): Business[] {
  const normalized = normalizeSearch(search);
  return records.filter(record => (category === "all" || record.category === category) &&
    normalizeSearch(`${record.name} ${record.address ?? ""} ${record.subtype}`).includes(normalized));
}

