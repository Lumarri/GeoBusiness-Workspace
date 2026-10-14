"use client";
import { useState } from "react";
import { categories } from "@/lib/categories";
import type { NearbyResult } from "@/lib/types";

const pct = (n: number | null) => n === null ? "Sin dato" : `${Math.round(n * 100)} %`;
export default function TerritorialDashboard({ result }: { result: NearbyResult | null }) {
  const [tab, setTab] = useState<"territory" | "quality" | "method">("territory");
  const a = result?.analysis;
  const dominant = categories.find(c => c.id === a?.dominant_category);
  const exportAnalysis = () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `geobusiness-${result.radius_m}m.json`; link.click(); URL.revokeObjectURL(url);
  };
  return <section id="territorial-dashboard" className="territorial-dashboard" aria-labelledby="territorial-title">
    <div className="dashboard-heading"><div><span className="eyebrow">LECTURA ESPACIAL</span><h2 id="territorial-title">Análisis territorial</h2><p>Indicadores del radio completo. Los filtros del mapa no cambian esta base de análisis.</p></div><button className="dashboard-export" disabled={!result} onClick={exportAnalysis}>Exportar análisis JSON</button></div>
    <div className="dashboard-tabs" role="tablist" aria-label="Apartados del análisis">{([
      ["territory", "Indicadores"], ["quality", "Calidad de datos"], ["method", "Metodología"],
    ] as const).map(([id, label]) => <button id={`territory-${id}`} key={id} role="tab" aria-selected={tab === id} aria-controls="territory-content" onClick={() => setTab(id)}>{label}</button>)}</div>
    <div id="territory-content" role="tabpanel" aria-labelledby={`territory-${tab}`}>
      {tab === "method" ? <div className="method-text"><h3>Qué calculamos</h3><p>La densidad divide los registros entre el área del círculo. La diversidad usa la entropía de Shannon, normalizada entre 0 y 1 para las seis categorías; un valor alto indica una composición más repartida, no una mejor oportunidad.</p><p>La distancia al vecino más próximo se calcula entre registros OSM con Haversine, en línea geográfica. La proximidad indica qué fracción tiene otro registro a 50 m o menos. No es tiempo a pie ni identifica competidores directos. Puede verse afectada por registros físicos duplicados.</p><p>Los cálculos entre vecinos son exactos para entre 2 y 2.000 registros; fuera de ese rango se muestran como sin dato. No hay un puntaje de rentabilidad.</p></div> : !result ? <div className="dashboard-empty">Busca una ubicación y pulsa Analizar para obtener indicadores y revisar la calidad de sus registros.</div> : !a ? <div className="dashboard-empty">Este análisis guardado corresponde a una versión anterior. Vuelve a consultar la ubicación para obtener los nuevos indicadores.</div> : tab === "quality" ? <><div className="metric-grid">
        <article><span>Con nombre o marca</span><strong>{pct(a.named_share)}</strong><p>Presencia de una etiqueta; no verifica el establecimiento.</p></article>
        <article><span>Con dirección</span><strong>{pct(a.addressed_share)}</strong><p>Dirección registrada en OSM; puede estar incompleta.</p></article>
        <article><span>Con horario</span><strong>{pct(a.hours_share)}</strong><p>No garantiza apertura actual.</p></article>
      </div><p className="dashboard-caution">Estos porcentajes describen los registros obtenidos, no la cobertura comercial de la zona. No hay un censo de referencia para medir cuántos negocios faltan.</p><p>Consulta: {new Date(result.source.retrieved_at).toLocaleString("es-PE", { timeZone: "America/Lima" })} (Lima). {Date.parse(result.source.cache_expires_at) <= Date.now() ? "La caché venció: vuelve a consultar." : "Dentro del TTL de la consulta; puede haber cambios en campo."}</p></> : <>
        <div className="metric-grid">
          <article><span>Densidad registrada</span><strong>{a.records_per_km2.toLocaleString("es-PE")}</strong><p>Registros OSM/km² · área {a.area_km2.toLocaleString("es-PE")} km².</p></article>
          <article><span>Diversidad de categorías</span><strong>{a.diversity_index === null ? "Sin dato" : a.diversity_index.toFixed(2)}</strong><p>De 0 a 1: composición más concentrada o más repartida.</p></article>
          <article><span>Categoría predominante</span><strong className="metric-label">{dominant?.label ?? (result.total_in_radius ? "Sin categoría única" : "Sin dato")}</strong><p>{pct(a.dominant_share)} de los registros del radio.</p></article>
          <article><span>Vecino más próximo</span><strong>{a.mean_nearest_neighbor_m === null ? "Sin dato" : `${a.mean_nearest_neighbor_m.toLocaleString("es-PE")} m`}</strong><p>Media entre cada registro y su vecino; distancia geográfica.</p></article>
          <article><span>Con otro registro a ≤ 50 m</span><strong>{pct(a.share_with_neighbor_50m)}</strong><p>Describe proximidad espacial, no competencia directa.</p></article>
          <article><span>Registros analizados</span><strong>{result.total_in_radius}</strong><p>Fuente OSM; cobertura no exhaustiva.</p></article>
        </div>
        <div className="territory-reading"><h3>Lectura de esta ubicación</h3>{result.total_in_radius === 0 ? <p>No se obtuvieron registros. No puede concluirse que no existan negocios ni que haya una oportunidad.</p> : <><p>{dominant ? `${dominant.label} reúne ${pct(a.dominant_share)} de lo registrado.` : "No hay una categoría predominante disponible."} Compara con otras ubicaciones usando el mismo radio y revisa las fechas.</p><p>{a.mean_nearest_neighbor_m === null ? "El indicador de vecinos no se calculó: requiere entre 2 y 2.000 registros." : `Los registros tienen un vecino a ${a.mean_nearest_neighbor_m} m en promedio. Contrasta esta distribución con accesos, cruces y actividad real.`}</p></>}</div>
        <p className="dashboard-caution">Faltan demanda, alquileres, afluencia peatonal y ventas. Estos indicadores no permiten predecir rentabilidad ni elegir una ubicación ganadora.</p>
      </>}
    </div>
  </section>;
}
