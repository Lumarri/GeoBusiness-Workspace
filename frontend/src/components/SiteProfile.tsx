"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { emptySite, grossRevenue, siteKey, siteSchema, sitesSchema, SITE_STORAGE, type Site } from "@/lib/site";
import type { NearbyResult, Point } from "@/lib/types";

const weatherSchema = z.object({
  provider: z.literal("Open-Meteo"), timezone: z.literal("America/Lima"), retrieved_at: z.string(),
  limitations: z.string(), current: z.object({ time: z.string(), temperature_2m: z.number().nullable(), relative_humidity_2m: z.number().min(0).max(100).nullable(), precipitation: z.number().nonnegative().nullable(), wind_speed_10m: z.number().nonnegative().nullable(), weather_code: z.number().int().nullable() }),
});
type Weather = z.infer<typeof weatherSchema>;
const money = (n: number | null) => n === null ? "Sin datos" : new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);
const amount = (n: number | null, unit: string) => n === null ? "Sin datos" : `${n.toLocaleString("es-PE")} ${unit}`;
export default function SiteProfile({ point, result, inRegion }: { point: Point; result: NearbyResult | null; inRegion: boolean }) {
  const [site, setSite] = useState<Site>({ ...emptySite });
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherMessage, setWeatherMessage] = useState("");
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const key = siteKey(point);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SITE_STORAGE);
      const saved = raw ? sitesSchema.parse(JSON.parse(raw)).sites : {};
      setSite(saved[key] ?? { ...emptySite }); setReady(true); setMessage("");
    } catch { setSite({ ...emptySite }); setReady(false); setMessage("No se puede leer el almacenamiento. Se conserva y no se sobrescribirá."); }
  }, [key]);
  useEffect(() => {
    const controller = new AbortController(); setWeather(null); setWeatherMessage("");
    if (!inRegion) { setWeatherLoading(false); return () => controller.abort(); }
    setWeatherLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/v1/weather?lat=${point.lat}&lng=${point.lng}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : "Clima no disponible.");
        const parsed = weatherSchema.parse(payload);
        if (!controller.signal.aborted) setWeather(parsed);
      } catch (error) { if (!controller.signal.aborted) setWeatherMessage(error instanceof Error ? error.message : "Clima no disponible."); }
      finally { if (!controller.signal.aborted) setWeatherLoading(false); }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [point.lat, point.lng, inRegion, retry]);
  function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      const valid = siteSchema.parse(site);
      const raw = localStorage.getItem(SITE_STORAGE);
      const current = raw ? sitesSchema.parse(JSON.parse(raw)) : { version: 1 as const, sites: {} as Record<string, Site> };
      const next = sitesSchema.parse({ ...current, sites: { ...current.sites, [key]: valid } });
      localStorage.setItem(SITE_STORAGE, JSON.stringify(next)); setMessage("Ficha guardada en este navegador para este punto.");
    } catch (error) { setMessage(error instanceof z.ZodError ? error.issues[0].message : "No se pudo guardar; el almacenamiento puede estar lleno o deshabilitado."); }
  }
  const revenue = grossRevenue(site);
  const validReport = siteSchema.safeParse(site);
  const report = validReport.success ? validReport.data : emptySite;
  return <section id="site-profile" className="site-profile" aria-labelledby="site-title">
    <div className="dashboard-heading"><div><span className="eyebrow">EL PUNTO SELECCIONADO</span><h2 id="site-title">Ficha del lugar</h2><p>{point.lat.toFixed(6)}, {point.lng.toFixed(6)} · Activa Ajustar punto para arrastrar el pin o usar las flechas del teclado; también puedes editar coordenadas. Los decimales no garantizan precisión del dato original ni delimitan una parcela.</p></div></div>
    <div className="metric-grid">
      <article><span>Disponibilidad reportada</span><strong className="metric-label">{report.status === "unknown" ? "Sin verificar" : report.status === "available" ? "Disponible · reporte propio" : "Ocupado · reporte propio"}</strong><p>{report.status !== "unknown" && report.source && report.date ? `Fuente: ${report.source}. Fecha: ${report.date}. Confirma su vigencia con el propietario.` : "Sin fuente de ocupación o alquiler. La ausencia de negocios OSM no indica disponibilidad."}</p></article>
      <article><span>Ingreso de hogares reportado</span><strong>{money(report.householdIncome)}</strong><p>PEN/mes por hogar, según tu fuente. No se deduce de los negocios cercanos ni se atribuye automáticamente al inmueble. {report.householdIncome !== null && `Fuente reportada: ${report.source} · ${report.date}.`}</p></article>
      <article><span>Público reportado</span><strong className="metric-label">{amount(report.footfall, "personas/hora")}</strong><p>Población de la zona reportada: {amount(report.population, "personas")}. Indica la zona y periodo de medición en la fuente. {(report.population !== null || report.footfall !== null) && `Fuente reportada: ${report.source} · ${report.date}.`}</p></article>
      <article><span>Ingresos brutos del escenario</span><strong>{money(revenue)}</strong><p>Ticket × clientes/día × días/mes. Supuestos tuyos; no ventas observadas, beneficios ni predicción de la ubicación.</p></article>
      <article><span>Negocios cercanos</span><strong>{result?.total_in_radius ?? "Sin consulta"}</strong><p>{result ? `Registros OSM dentro de ${result.radius_m} m. Consulta: ${new Date(result.source.retrieved_at).toLocaleString("es-PE", { timeZone: "America/Lima" })}.` : "Selecciona un punto para consultar OSM automáticamente, o pulsa Analizar ubicación. La información anterior no se reutiliza para otro lugar."}</p></article>
      <article><span>Clima del punto · modelo</span><strong>{weatherLoading ? "Consultando…" : weather ? amount(weather.current.temperature_2m, "°C") : "Sin datos"}</strong><p>{weather ? `Humedad ${amount(weather.current.relative_humidity_2m, "%")}; viento ${amount(weather.current.wind_speed_10m, "km/h")}; precipitación ${amount(weather.current.precipitation, "mm")}. ${weather.current.time.replace("T", " ")} (Lima). Fuente: Open-Meteo; dato de celda, no sensor en el local.` : weatherMessage || "El clima requiere conexión a la API y una ubicación dentro de la región."}</p>{weatherMessage && <button type="button" onClick={() => setRetry(n => n + 1)}>Reintentar clima</button>}</article>
    </div>
    <details className="site-editor"><summary>Registrar datos, disponibilidad y supuestos del lugar</summary><form onSubmit={save}>
      <div className="site-form-grid">
        <label>Estado reportado<select aria-label="Estado reportado" value={site.status} onChange={e => setSite({ ...site, status: e.target.value as Site["status"] })}><option value="unknown">Sin verificar</option><option value="available">Disponible</option><option value="occupied">Ocupado</option></select></label>
        <label>Fuente y alcance<input maxLength={250} value={site.source} onChange={e => setSite({ ...site, source: e.target.value })} placeholder="Ej. contacto del propietario / informe distrital" /></label>
        <label>Fecha de la fuente<input type="date" value={site.date} onChange={e => setSite({ ...site, date: e.target.value })} /></label>
        {([
          ["householdIncome", "Ingreso por hogar (PEN/mes)"], ["population", "Población de la zona (personas)"], ["footfall", "Afluencia observada (personas/hora)"],
          ["ticket", "Ticket supuesto (PEN/cliente)"], ["customers", "Clientes supuestos por día"], ["days", "Días de operación al mes"],
        ] as const).map(([field, label]) => <label key={field}>{label}<input type="number" min={field === "days" ? 1 : 0} max={field === "days" ? 31 : 1e9} step={field === "days" ? 1 : "any"} value={site[field] ?? ""} onChange={e => setSite({ ...site, [field]: e.target.value === "" ? null : Number(e.target.value) })} /></label>)}
        <label className="site-notes">Notas del local<textarea maxLength={500} value={site.notes} onChange={e => setSite({ ...site, notes: e.target.value })} placeholder="Área del local, acceso, alquiler, contacto, condiciones de verificación…" /></label>
      </div><button type="submit" disabled={!ready}>Guardar ficha del lugar</button><p>Datos reportados y supuestos guardados en este navegador, sin sincronización. Un estado reportado no es una certificación de disponibilidad.</p>
    </form></details>
    {message && <p role="status">{message}</p>}
    <p className="dashboard-caution">Portal oficial de referencia: <a href="https://www.geoidep.gob.pe/" target="_blank" rel="noreferrer">GEOIDEP</a>. Aún no hay una capa de población, ingresos o catastro integrada: necesitamos servicio, fecha, cobertura y licencia. El catastro por sí solo tampoco informa si un local está en alquiler. <a href="https://www.geoidep.gob.pe/catalogo-nacional-de-servicios-web/servicios_rest_arcgis_mapserver" target="_blank" rel="noreferrer">Directorio REST</a> · <a href="https://catalogo.geoidep.gob.pe/metadatos/" target="_blank" rel="noreferrer">Metadatos oficiales</a></p>
  </section>;
}
