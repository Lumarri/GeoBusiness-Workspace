"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { Point } from "@/lib/types";

const responseSchema = z.object({
  results: z.array(z.object({ label: z.string(), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })),
  provider: z.literal("OpenStreetMap / Nominatim"), license: z.literal("ODbL-1.0"),
});
export default function AddressSearch({ onSelect }: { onSelect: (p: Point) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<z.infer<typeof responseSchema>["results"]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function search(event: React.FormEvent) {
    event.preventDefault();
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setLoading(true); setResults([]); setMessage("");
    try {
      const response = await fetch(`/api/v1/locations/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : "No se pudo buscar la dirección.");
      const data = responseSchema.parse(payload);
      if (active.current !== controller) return;
      setResults(data.results);
      if (!data.results.length) setMessage("No se encontraron direcciones en la región habilitada.");
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Error de búsqueda.");
    } finally { if (active.current === controller) setLoading(false); }
  }
  return <section className="address-search" aria-label="Buscar ubicación">
    <form onSubmit={search}><label htmlFor="address-query">Buscar dirección o lugar en Lima</label><div className="address-input"><input id="address-query" minLength={3} maxLength={160} required value={query} onChange={event => { active.current?.abort(); active.current = null; setLoading(false); setQuery(event.target.value); setResults([]); setMessage(""); }} placeholder="Ej. Parque Kennedy, Miraflores" /><button type="submit" disabled={loading || query.trim().length < 3}>{loading ? "Buscando…" : "Buscar dirección"}</button></div></form>
    <div aria-live="polite">{message && <p>{message}</p>}{results.length > 0 && <ul>{results.map((item, index) => <li key={index}><button onClick={() => { onSelect({ lat: item.lat, lng: item.lng }); setResults([]); setMessage(`Ubicación seleccionada: ${item.label}`); }}>{item.label}</button></li>)}</ul>}</div>
    <small>Geocodificación: OpenStreetMap / Nominatim · ODbL. La dirección no verifica la actividad comercial.</small>
  </section>;
}
