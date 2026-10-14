"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronRight, Database, Info, MapPin, Search, X } from "lucide-react";
import CategoryChart from "./CategoryChart";
import { colors } from "@/lib/categories";
import type { Business, NearbyResult, Point, Radius } from "@/lib/types";

type Props = {
  result: NearbyResult | null; visible: Business[]; loading: boolean; point: Point; radius: Radius;
  focused: Business | null; onFocus: (business: Business | null) => void;
  onMethodology: () => void; onResetFilters: () => void;
};

export default function AnalysisPanel({ result, visible, loading, point, radius, focused, onFocus, onMethodology, onResetFilters }: Props) {
  const [tab, setTab] = useState<"businesses" | "overview">("businesses");
  const [limit, setLimit] = useState(40);
  useEffect(() => { setLimit(40); }, [visible]);

  return <aside className="analysis-panel" aria-label="Análisis territorial">
    <div className="analysis-heading"><div><span className="eyebrow">TU ÁREA DE ANÁLISIS</span><h2>Lectura del territorio</h2></div><button className="icon-button" onClick={onMethodology} aria-label="Ver metodología"><Info size={18} /></button></div>
    <div className="location-summary"><div className="location-icon"><MapPin size={19} /></div><div><strong>{result?.region ?? "Lima Metropolitana"}</strong><p>{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</p></div><span className="radius-chip">{radius.toLocaleString("es-PE")} m</span></div>
    <div className="stat-grid"><div><span>Registros OSM</span><strong>{loading ? "…" : result ? result.total_in_radius.toLocaleString("es-PE") : "—"}</strong></div><div><span>Categorías presentes</span><strong>{loading ? "…" : result ? result.categories.filter(item => item.count > 0).length : "—"}<small> / 6</small></strong></div></div>
    <div className="panel-tabs" role="tablist" aria-label="Vista de resultados">
      <button role="tab" id="businesses-tab" aria-selected={tab === "businesses"} aria-controls="analysis-content" onClick={() => setTab("businesses")}>Establecimientos{result && <span>{visible.length}</span>}</button>
      <button role="tab" id="overview-tab" aria-selected={tab === "overview"} aria-controls="analysis-content" onClick={() => setTab("overview")}>Resumen</button>
    </div>
    <div className="panel-content" id="analysis-content" role="tabpanel" aria-labelledby={tab === "businesses" ? "businesses-tab" : "overview-tab"} aria-busy={loading}>
      {loading ? <div className="panel-empty"><span className="spinner" /><h3>Consultando el territorio</h3><p>Buscando registros de establecimientos en OpenStreetMap. Puede tardar unos segundos.</p></div> : !result ? <div className="panel-empty"><div className="empty-illustration"><Search size={32} /><span /></div><h3>Tu próxima idea empieza aquí</h3><p>Elige un punto del mapa, ajusta el radio y pulsa <strong>Analizar ubicación</strong>.</p><div className="steps"><span>01 · Selecciona</span><ChevronRight size={12} /><span>02 · Explora</span><ChevronRight size={12} /><span>03 · Decide</span></div></div> : tab === "overview" ? <>
        <div className="section-heading"><h3>Composición comercial</h3><span>Registros, no ventas</span></div>
        {result.total_in_radius > 0 ? <CategoryChart result={result} /> : <p className="muted-note">No hay registros disponibles en este radio.</p>}
        <div className="counts-table">{result.categories.map(item => <div key={item.category}><span><i style={{ background: colors[item.category] }} />{item.label}</span><strong>{item.count}</strong></div>)}</div>
        <div className="insight-note"><Info size={17} /><p>La presencia de comercios describe lo registrado en OSM. Por sí sola no demuestra demanda, saturación ni viabilidad económica.</p></div>
        <h3 className="source-title">Transparencia del análisis</h3>
        <dl className="source-details"><div><dt>Origen</dt><dd>OpenStreetMap / Overpass</dd></div><div><dt>Consultado</dt><dd>{new Date(result.source.retrieved_at).toLocaleString("es-PE", { timeZone: "America/Lima" })} (Lima)</dd></div><div><dt>Respuesta</dt><dd>{result.source.cache_hit ? "Desde caché" : "Consulta al proveedor"}</dd></div><div><dt>Licencia</dt><dd><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{result.source.license}<ArrowUpRight size={12} /></a></dd></div></dl>
        <ul className="limitations">{result.source.limitations.map(text => <li key={text}>{text}</li>)}</ul>
      </> : <>
        {focused && <div className="business-detail"><button className="detail-close" onClick={() => onFocus(null)} aria-label="Cerrar detalle"><X size={15} /></button><span className="eyebrow">REGISTRO SELECCIONADO</span><h3>{focused.name}</h3><p>{focused.address ?? "Sin dirección registrada"}</p><p>{focused.opening_hours ? `Horario OSM: ${focused.opening_hours}` : "Sin horario registrado"}</p><small>{focused.location_method === "node" ? "Coordenada de nodo OSM" : "Centro de caja envolvente: posición aproximada"}</small><a href={focused.osm_url} target="_blank" rel="noreferrer">Ver fuente OSM <ArrowUpRight size={13} /></a></div>}
        <div className="list-heading"><span>{visible.length} de {result.total_in_radius} registros</span><span>Más cercanos primero</span></div>
        {visible.length === 0 ? <div className="panel-empty compact"><Search size={24} /><h3>{result.total_in_radius === 0 ? "Sin registros en este radio" : "Sin coincidencias"}</h3><p>{result.total_in_radius === 0 ? "La cobertura OSM puede ser incompleta. Amplía el radio o contrasta la zona presencialmente." : "Prueba otra categoría o modifica tu búsqueda."}</p>{result.total_in_radius > 0 && <button className="text-button" onClick={onResetFilters}>Limpiar filtros</button>}</div> : <div className="business-list">{visible.slice(0, limit).map(business => <button className={`business-card ${focused?.osm_id === business.osm_id ? "is-focused" : ""}`} key={business.osm_id} onClick={() => onFocus(business)}><div className="business-category-icon" style={{ color: colors[business.category], background: `${colors[business.category]}15` }}><MapPin size={17} /></div><div className="business-copy"><strong>{business.name}</strong><span>{business.category_label}</span><small>{business.address ?? "Dirección no registrada"}</small></div><div className="business-distance"><strong>{Math.round(business.distance_m)} m</strong><ArrowUpRight size={13} /></div></button>)}{visible.length > limit && <button className="load-more" onClick={() => setLimit(value => value + 40)}>Mostrar 40 registros más</button>}</div>}
      </>}
    </div>
    <div className="panel-footer"><Database size={13} /><span>{result ? "Registros OSM · cobertura no exhaustiva" : "Datos abiertos. Decisiones informadas."}</span><button onClick={onMethodology}>Método <ArrowUpRight size={12} /></button></div>
  </aside>;
}

