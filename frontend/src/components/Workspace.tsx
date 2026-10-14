"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Building2, ChevronDown, ChevronRight, CircleHelp, Crosshair, Layers, Map, MapPin, Menu, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, Wallet, X } from "lucide-react";
import AddressSearch from "./AddressSearch";
import AnalysisLibrary from "./AnalysisLibrary";
import TerritorialDashboard from "./TerritorialDashboard";
import AnalysisPanel from "./AnalysisPanel";
import { ApiError, getNearby, getRegion } from "@/lib/api";
import { filterBusinesses } from "@/lib/businesses";
import { categories } from "@/lib/categories";
import { withinRegion } from "@/lib/geo";
import type { Business, Category, NearbyResult, Point, Radius, Region } from "@/lib/types";

const CommercialMap = dynamic(() => import("./CommercialMap"), { ssr: false, loading: () => <div className="map-stage map-loading">Cargando herramientas del mapa…</div> });
const START: Point = { lat: -12.1211, lng: -77.0300 };
const presets = [
  { name: "Miraflores", description: "Referencia de navegación", point: START },
  { name: "Centro de Lima", description: "Referencia de navegación", point: { lat: -12.0464, lng: -77.0428 } },
  { name: "San Juan de Lurigancho", description: "Referencia de navegación", point: { lat: -11.9830, lng: -76.9998 } },
];

export default function Workspace() {
  const [point, setPoint] = useState<Point>(START);
  const [radius, setRadius] = useState<Radius>(500);
  const [category, setCategory] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<NearbyResult | null>(null);
  const [focused, setFocused] = useState<Business | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [configError, setConfigError] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [latInput, setLatInput] = useState(START.lat.toFixed(6));
  const [lngInput, setLngInput] = useState(START.lng.toFixed(6));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [configAttempt, setConfigAttempt] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const requestVersion = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const abort = new AbortController();
    setConfigError(false);
    getRegion(abort.signal).then(setRegion).catch(() => { if (!abort.signal.aborted) setConfigError(true); });
    return () => abort.abort();
  }, [configAttempt]);
  useEffect(() => () => { controller.current?.abort(); }, []);
  useEffect(() => {
    if (!retryAt) { setRemaining(0); return; }
    const tick = () => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [retryAt]);

  const invalidate = useCallback(() => {
    controller.current?.abort();
    requestVersion.current += 1;
    setResult(null); setFocused(null); setLoading(false); setError(null);
  }, []);

  const selectPoint = useCallback((next: Point) => {
    invalidate();
    setPoint(next); setLatInput(next.lat.toFixed(6)); setLngInput(next.lng.toFixed(6));
    setSidebarOpen(false);
    if (region && !withinRegion(next, region.bbox)) setError("Ese punto está fuera de la región habilitada. Elige una ubicación en Lima Metropolitana.");
  }, [invalidate, region]);

  const visible = useMemo(() => filterBusinesses(result?.businesses ?? [], category, search), [result, category, search]);
  // Detail and popup never refer to a business hidden by the current filters.
  useEffect(() => { if (focused && !visible.some(item => item.osm_id === focused.osm_id)) setFocused(null); }, [focused, visible]);

  async function analyze() {
    if (remaining || loading) return;
    if (region && !withinRegion(point, region.bbox)) { setError("Selecciona un punto dentro de Lima Metropolitana."); return; }
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const version = ++requestVersion.current;
    setLoading(true); setError(null); setResult(null); setFocused(null);
    try {
      const data = await getNearby(point, radius, abort.signal);
      if (version === requestVersion.current) setResult(data);
    } catch (exc) {
      if (abort.signal.aborted || version !== requestVersion.current) return;
      setError(exc instanceof Error ? exc.message : "Ocurrió un error al consultar el territorio.");
      if (exc instanceof ApiError && exc.retryAfter) setRetryAt(Date.now() + exc.retryAfter * 1000);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }

  function applyCoordinates(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lat = Number(latInput), lng = Number(lngInput);
    if (!latInput.trim() || !lngInput.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setError("Introduce latitud y longitud válidas, usando punto decimal."); return;
    }
    selectPoint({ lat, lng });
  }

  function newAnalysis() {
    selectPoint(START); setRadius(500); setCategory("all"); setSearch("");
  }

  return <div className="workspace">
    <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`} aria-label="Herramientas de GeoBusiness">
      <a href="/" className="brand" aria-label="GeoBusiness AI, inicio"><div className="brand-mark"><Layers size={24} strokeWidth={1.8} /></div><div>GeoBusiness<span>INTELLIGENCE PLATFORM <i>AI</i></span></div></a>
      <button className="new-analysis" onClick={newAnalysis}><Plus size={16} /> Nuevo análisis</button>
      <span className="sidebar-label">ESPACIO DE TRABAJO</span>
      <nav className="main-nav"><button className="active" onClick={() => setSidebarOpen(false)}><Map size={18} /> Explorador territorial <ChevronRight size={14} /></button><button onClick={() => { setSidebarOpen(false); document.getElementById("territorial-dashboard")?.scrollIntoView({ behavior: "smooth" }); }}><Building2 size={18} /> Análisis territorial</button><button onClick={() => { setSidebarOpen(false); document.getElementById("saved-analyses")?.scrollIntoView({ behavior: "smooth" }); }}><SlidersHorizontal size={18} /> Comparar ubicaciones</button><button disabled title="Disponible en una siguiente etapa"><Wallet size={18} /> Simulador financiero <span>Próx.</span></button><button disabled title="Disponible en una siguiente etapa"><Sparkles size={18} /> Asistente comercial <span>Próx.</span></button></nav>
      <div className="sidebar-divider" />
      <span className="sidebar-label">EXPLORAR LIMA</span>
      <div className="preset-list">{presets.map(preset => <button key={preset.name} onClick={() => selectPoint(preset.point)}><MapPin size={15} /><div><strong>{preset.name}</strong><small>{preset.description}</small></div><ArrowUpRight size={13} /></button>)}</div>
      <div className="sidebar-bottom"><div className="pilot-card"><span className="pilot-icon"><Building2 size={18} /></span><span className="eyebrow">PRIMERA ETAPA</span><h3>Una ciudad.<br />Muchas posibilidades.</h3><p>Explora el tejido comercial de Lima con datos abiertos.</p><button onClick={() => dialog.current?.showModal()}>Conoce la metodología <ArrowRight size={14} /></button></div><button className="help-button" onClick={() => dialog.current?.showModal()}><CircleHelp size={16} /> Guía y fuentes <ArrowUpRight size={13} /></button><div className="workspace-identity"><div>G</div><span>GeoBusiness Workspace<small>Proyecto piloto · Lima, Perú</small></span></div></div>
    </aside>
    {sidebarOpen && <button className="sidebar-backdrop" aria-label="Cerrar herramientas" onClick={() => setSidebarOpen(false)} />}
    <main className="main-workspace">
      <header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" aria-label="Abrir herramientas" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button><span>Workspace</span><ChevronRight size={13} /><strong>Explorador territorial</strong></div><div className="topbar-right"><span className="pilot-badge">EXPLORACIÓN · ANÁLISIS</span><span className="region-badge"><MapPin size={13} /> Lima, PE</span><div className="avatar" aria-label="GeoBusiness">G</div></div></header>
      <section className="workspace-intro"><div><span className="eyebrow">INTELIGENCIA PARA TU PRÓXIMO NEGOCIO</span><h1>Encuentra tu lugar en la ciudad<span>.</span></h1><p>Explora el entorno comercial antes de dar el siguiente paso.</p></div><button className="method-button" onClick={() => dialog.current?.showModal()}><ShieldCheck size={16} /> Fuentes transparentes <ArrowUpRight size={14} /></button></section>
      <div className="explorer-layout"><section className="map-panel" aria-label="Explorador comercial">
        <AddressSearch onSelect={selectPoint} /><div className="map-toolbar"><div className="search-field"><Search size={17} /><input aria-label="Buscar en los establecimientos consultados" placeholder="Buscar en los establecimientos consultados…" value={search} maxLength={100} onChange={event => setSearch(event.target.value)} />{search && <button aria-label="Limpiar búsqueda" onClick={() => setSearch("")}><X size={14} /></button>}</div><label className="category-select"><SlidersHorizontal size={15} /><select aria-label="Categoría comercial" value={category} onChange={event => setCategory(event.target.value as Category | "all")}><option value="all">Todas las categorías</option>{categories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><ChevronDown size={13} /></label></div>
        <div className="map-area"><CommercialMap point={point} radius={radius} businesses={visible} focused={focused} onSelect={selectPoint} onBusinessSelect={setFocused} /><div className="map-top-badge"><span className="live-dot" /><span>Lima Metropolitana</span><small>OSM</small></div><div className="map-hint"><Crosshair size={15} /><span>Haz clic para elegir tu ubicación</span></div></div>
        <div className="analysis-controls"><div className="radius-control"><label id="radius-label">Radio de análisis</label><div role="group" aria-labelledby="radius-label">{([250, 500, 1000] as Radius[]).map(value => <button key={value} className={radius === value ? "selected" : ""} aria-pressed={radius === value} onClick={() => { invalidate(); setRadius(value); }}>{value === 1000 ? "1.000" : value} m</button>)}</div></div><button className="analyze-button" disabled={loading || remaining > 0} onClick={analyze}>{loading ? <span className="spinner white" /> : <Crosshair size={17} />}{loading ? "Consultando…" : remaining > 0 ? `Espera ${remaining} s` : "Analizar ubicación"}{!loading && <ArrowRight size={16} />}</button></div>
        <div className="coordinate-row"><details><summary><MapPin size={13} /> {point.lat.toFixed(5)}, {point.lng.toFixed(5)} <ChevronDown size={12} /></summary><form onSubmit={applyCoordinates}><label>Latitud<input required type="number" step="any" min="-90" max="90" value={latInput} onChange={event => setLatInput(event.target.value)} /></label><label>Longitud<input required type="number" step="any" min="-180" max="180" value={lngInput} onChange={event => setLngInput(event.target.value)} /></label><button type="submit">Ubicar</button></form></details><span>Radio geográfico · no es una ruta a pie</span></div>
        {(error || configError) && <div className="query-error" role="alert"><CircleHelp size={16} /><span>{error ?? "No se pudo conectar con la API. Inicia el backend para consultar establecimientos."}</span>{configError && <button onClick={() => setConfigAttempt(value => value + 1)}>Verificar conexión</button>}</div>}
        <div className="map-legend"><span>CAPAS COMERCIALES</span>{categories.map(item => <button key={item.id} className={category === item.id ? "active" : ""} onClick={() => setCategory(category === item.id ? "all" : item.id)} aria-pressed={category === item.id}><i style={{ background: item.color }} />{item.short}</button>)}</div>
      </section><AnalysisPanel result={result} visible={visible} loading={loading} point={point} radius={radius} focused={focused} onFocus={setFocused} onMethodology={() => dialog.current?.showModal()} onResetFilters={() => { setCategory("all"); setSearch(""); }} /></div>
      <TerritorialDashboard result={result} />
      <AnalysisLibrary result={result} onOpen={analysis => {
        selectPoint(analysis.result.location); setRadius(analysis.result.radius_m);
        setCategory("all"); setSearch(""); setResult(analysis.result);
      }} />
      <footer className="workspace-footer"><span><ShieldCheck size={13} /> Datos registrados, supuestos explícitos.</span><a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Reportar un problema en el mapa <ArrowUpRight size={12} /></a></footer>
    </main>
    <dialog ref={dialog} className="method-dialog"><div className="dialog-heading"><div><span className="eyebrow">TRANSPARENCIA, DESDE EL INICIO</span><h2>Qué nos dice el mapa</h2></div><button className="icon-button" onClick={() => dialog.current?.close()} aria-label="Cerrar metodología"><X size={20} /></button></div><div className="dialog-body"><p>GeoBusiness AI consulta establecimientos etiquetados en <strong>OpenStreetMap</strong> mediante Overpass. Esta primera etapa ofrece exploración territorial; no genera predicciones económicas.</p><h3>Datos registrados</h3><p>Nombres, categorías, direcciones y horarios provienen de OSM. No están verificados presencialmente y pueden faltar o haber cambiado. Los conteos representan registros OSM, no un censo comercial.</p><h3>Cálculos y clasificación</h3><p>El radio y las distancias se calculan sobre una esfera con la fórmula de Haversine. Para áreas y relaciones se usa el centro de su caja envolvente. Las categorías agrupan etiquetas OSM mediante reglas documentadas.</p><h3>Consultas responsables</h3><p>Solo se consulta al pulsar Analizar. Los filtros reutilizan el resultado. La API usa caché durante 24 horas por defecto y limita las consultas externas. El mapa conserva la atribución y el caché del navegador.</p><h3>Siguientes etapas</h3><p>Redes de calles, comparación explicable, simulación económica y recomendaciones se incorporarán en etapas posteriores. No hay una puntuación comercial oculta detrás de los resultados.</p><div className="method-links"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Licencia ODbL <ArrowUpRight size={13} /></a><a href="https://operations.osmfoundation.org/policies/tiles/" target="_blank" rel="noreferrer">Uso de mapas <ArrowUpRight size={13} /></a></div></div><div className="dialog-footer"><button className="analyze-button" onClick={() => dialog.current?.close()}>Volver al explorador <ArrowRight size={15} /></button></div></dialog>
  </div>;
}

