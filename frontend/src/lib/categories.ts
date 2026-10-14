import type { Category } from "./types";

export const categories: { id: Category; label: string; short: string; color: string }[] = [
  { id: "food", label: "Restaurantes y cafés", short: "Gastronomía", color: "#e48748" },
  { id: "groceries", label: "Alimentos y mercados", short: "Alimentos", color: "#38a879" },
  { id: "health", label: "Salud y farmacias", short: "Salud", color: "#6084d9" },
  { id: "retail", label: "Comercio minorista", short: "Comercio", color: "#9b72ca" },
  { id: "services", label: "Servicios", short: "Servicios", color: "#cf7ea8" },
  { id: "other", label: "Otros establecimientos", short: "Otros", color: "#859397" },
];
export const colors = Object.fromEntries(categories.map(item => [item.id, item.color])) as Record<Category, string>;

