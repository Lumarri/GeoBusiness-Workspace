"use client";
import { useEffect, useState } from "react";
import { canCompare, readAnalyses, STORAGE_KEY, writeAnalyses, type SavedAnalysis } from "@/lib/analyses";
import { categories } from "@/lib/categories";
import type { NearbyResult } from "@/lib/types";

export default function AnalysisLibrary({ result, onOpen }: { result: NearbyResult | null; onOpen: (a: SavedAnalysis) => void }) {
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { setAnalyses(readAnalyses(localStorage.getItem(STORAGE_KEY))); setReady(true); }
    catch { setMessage("No se pueden leer los análisis guardados. No se sobrescribirán. Revisa el almacenamiento de este navegador."); }
  }, []);
  function persist(next: SavedAnalysis[]) {
    try { localStorage.setItem(STORAGE_KEY, writeAnalyses(next)); setAnalyses(next); setMessage(""); return true; }
    catch { setMessage("No se pudo guardar. El almacenamiento puede estar lleno o deshabilitado; tus análisis anteriores se conservan."); return false; }
  }
  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!result || !name.trim() || !ready) return;
    if (analyses.length >= 10) { setMessage("Puedes guardar hasta 10 análisis. Elimina uno para añadir otro."); return; }
    if (persist([{ id: crypto.randomUUID(), name: name.trim(), savedAt: new Date().toISOString(), result }, ...analyses])) setName("");
  }
  const comparison = analyses.filter(a => selected.includes(a.id));
  const comparable = canCompare(comparison);
  return <section id="saved-analyses" className="analysis-library" aria-labelledby="saved-title">
    <h2 id="saved-title">Análisis guardados y comparación</h2>
    <p>Guardados en este navegador, hasta 10 análisis. No se sincronizan con una cuenta. Son una fotografía de la consulta, no datos actualizados en vivo.</p>
    <form onSubmit={save}><label htmlFor="analysis-name">Nombre del análisis</label><div className="address-input"><input id="analysis-name" maxLength={80} required value={name} onChange={event => setName(event.target.value)} placeholder="Ej. Local en Miraflores" /><button disabled={!result || !ready || !name.trim()}>Guardar análisis</button></div></form>
    {message && <p role="alert">{message}</p>}
    {!analyses.length && <p>Aún no hay análisis guardados. Consulta una ubicación para guardar sus resultados.</p>}
    <ul className="saved-list">{analyses.map(a => <li key={a.id}><label><input type="checkbox" checked={selected.includes(a.id)} disabled={!selected.includes(a.id) && selected.length >= 3} onChange={event => setSelected(event.target.checked ? [...selected, a.id] : selected.filter(id => id !== a.id))} /><strong>{a.name}</strong><span>{a.result.radius_m} m · {a.result.total_in_radius} registros · {new Date(a.result.source.retrieved_at).toLocaleString("es-PE")}</span></label><div><button onClick={() => onOpen(a)}>Abrir {a.name}</button><button onClick={() => { if (persist(analyses.filter(item => item.id !== a.id))) setSelected(selected.filter(id => id !== a.id)); }}>Eliminar {a.name}</button></div></li>)}</ul>
    <p>Selecciona entre 2 y 3 análisis de la misma región y radio para comparar.</p>
    {comparison.length >= 2 && !comparable && <p role="alert">Los radios o regiones son diferentes. Consulta y guarda ubicaciones con el mismo radio y región.</p>}
    {comparable && <div className="comparison-table"><table><caption>Comparación de registros OSM observados</caption><thead><tr><th scope="col">Indicador</th>{comparison.map(a => <th scope="col" key={a.id}>{a.name}</th>)}</tr></thead><tbody>
      <tr><th scope="row">Radio</th>{comparison.map(a => <td key={a.id}>{a.result.radius_m} m</td>)}</tr>
      <tr><th scope="row">Coordenadas</th>{comparison.map(a => <td key={a.id}>{a.result.location.lat.toFixed(5)}, {a.result.location.lng.toFixed(5)}</td>)}</tr>
      <tr><th scope="row">Fecha de consulta</th>{comparison.map(a => <td key={a.id}>{new Date(a.result.source.retrieved_at).toLocaleString("es-PE")}</td>)}</tr>
      <tr><th scope="row">Vigencia de caché</th>{comparison.map(a => <td key={a.id}>{Date.parse(a.result.source.cache_expires_at) <= Date.now() ? "Vencida; vuelve a consultar" : "Dentro del TTL de consulta"}</td>)}</tr>
      <tr><th scope="row">Total de registros</th>{comparison.map(a => <td key={a.id}>{a.result.total_in_radius}</td>)}</tr>
      {categories.map(c => <tr key={c.id}><th scope="row">{c.label}</th>{comparison.map(a => <td key={a.id}>{a.result.categories.find(item => item.category === c.id)?.count ?? "Sin dato"}</td>)}</tr>)}
    </tbody></table><p>La cobertura OSM puede variar entre ubicaciones y fechas. Estos conteos no miden demanda, competidores directos ni rentabilidad.</p></div>}
  </section>;
}
