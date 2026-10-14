"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as LibreMap } from "maplibre-gl";
import type { FeatureCollection, Point as GeoPoint } from "geojson";
import { colors } from "@/lib/categories";
import { radiusPolygon } from "@/lib/geo";
import type { Business, Point, Radius } from "@/lib/types";

type Props = {
  point: Point; radius: Radius; businesses: Business[]; focused: Business | null;
  onSelect: (point: Point) => void; onBusinessSelect: (business: Business) => void;
};

export default function CommercialMap({ point, radius, businesses, focused, onSelect, onBusinessSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LibreMap | null>(null);
  const callbacks = useRef({ onSelect, onBusinessSelect });
  const records = useRef(businesses);
  const initialPoint = useRef(point);
  const [mode, setMode] = useState<"points" | "clusters" | "heat">("points");
  const [showRadius, setShowRadius] = useState(true);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => { callbacks.current = { onSelect, onBusinessSelect }; records.current = businesses; }, [onSelect, onBusinessSelect, businesses]);

  useEffect(() => {
    if (!container.current) return;
    maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    let map: LibreMap;
    try {
      map = new maplibregl.Map({
        container: container.current, center: [initialPoint.current.lng, initialPoint.current.lat],
        zoom: 14.6, minZoom: 10, maxZoom: 19,
        attributionControl: false,
        style: {
          version: 8,
          sources: { basemap: {
            type: "raster", tileSize: 256,
            tiles: [process.env.NEXT_PUBLIC_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            attribution: `${process.env.NEXT_PUBLIC_TILE_ATTRIBUTION ?? ""} · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>`,
            maxzoom: 19,
          } },
          layers: [{ id: "basemap", type: "raster", source: "basemap", paint: { "raster-saturation": -0.45 } }],
        },
      });
    } catch {
      setMapError("No se pudo iniciar el mapa. Activa WebGL o utiliza el formulario de coordenadas.");
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.addControl(new maplibregl.AttributionControl({ compact: false }), "bottom-right");
    map.on("style.load", () => {
      if (map.getSource("radius")) return;
      map.addSource("radius", { type: "geojson", data: radiusPolygon(initialPoint.current, 500) });
      map.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": "#168575", "fill-opacity": 0.10 } });
      map.addLayer({ id: "radius-line", type: "line", source: "radius", paint: { "line-color": "#168575", "line-width": 2, "line-dasharray": [3, 2] } });
      map.addSource("selected", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "selected-halo", type: "circle", source: "selected", paint: { "circle-radius": 15, "circle-color": "#168575", "circle-opacity": 0.15 } });
      map.addLayer({ id: "selected-point", type: "circle", source: "selected", paint: { "circle-radius": 7, "circle-color": "#137a6c", "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
      map.addSource("businesses", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "business-points", type: "circle", source: "businesses", paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 15, 6, 19, 9],
        "circle-color": ["get", "color"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2,
      } });
      map.addSource("grouped-businesses", { type: "geojson", cluster: true, clusterRadius: 45, clusterMaxZoom: 16, data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "business-clusters", type: "circle", source: "grouped-businesses", filter: ["has", "point_count"], layout: { visibility: "none" }, paint: {
        "circle-color": "#155d50", "circle-radius": ["step", ["get", "point_count"], 15, 10, 22, 50, 30], "circle-opacity": 0.85, "circle-stroke-width": 2, "circle-stroke-color": "white",
      } });
      map.addLayer({ id: "business-unclustered", type: "circle", source: "grouped-businesses", filter: ["!", ["has", "point_count"]], layout: { visibility: "none" }, paint: { "circle-radius": 6, "circle-color": ["get", "color"], "circle-stroke-width": 2, "circle-stroke-color": "white" } });
      map.addLayer({ id: "business-heat", type: "heatmap", source: "businesses", layout: { visibility: "none" }, paint: {
        "heatmap-weight": 1, "heatmap-intensity": 1, "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 12, 16, 35], "heatmap-opacity": 0.7,
        "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(21,93,80,0)", 0.25, "#93d7bf", 0.5, "#38a879", 0.75, "#e9b35b", 1, "#d66c37"],
      } }, "radius-fill");
      setReady(true);
    });
    map.on("error", event => { console.error("MapLibre:", event.error.message); setMapError("No se pudo cargar una capa del mapa. Los resultados siguen disponibles; verifica la conexión o usa las coordenadas."); });
    map.on("click", event => {
      if (!map.getLayer("business-points")) return;
      const clusters = map.queryRenderedFeatures(event.point, { layers: ["business-clusters"] });
      if (clusters.length) {
        const f = clusters[0];
        const c = (f.geometry as GeoPoint).coordinates;
        (map.getSource("grouped-businesses") as GeoJSONSource).getClusterExpansionZoom(Number(f.properties.cluster_id)).then(zoom => {
          if (mapRef.current === map) map.easeTo({ center: [c[0], c[1]], zoom });
        }).catch(() => setMapError("No se pudo ampliar la agrupación. Usa los controles de zoom."));
        return;
      }
      const matches = map.queryRenderedFeatures(event.point, { layers: ["business-points", "business-unclustered"] });
      if (matches.length) {
        const business = records.current.find(item => item.osm_id === matches[0].properties.osm_id);
        if (business) callbacks.current.onBusinessSelect(business);
      } else callbacks.current.onSelect({ lat: event.lngLat.lat, lng: event.lngLat.wrap().lng });
    });
    const clusterPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
    map.on("mouseenter", "business-clusters", event => {
      map.getCanvas().style.cursor = "pointer";
      const f = event.features?.[0];
      if (f) {
        const c = (f.geometry as GeoPoint).coordinates;
        clusterPopup.setLngLat([c[0], c[1]]).setText(`${f.properties.point_count} registros. Haz clic para ampliar.`).addTo(map);
      }
    });
    map.on("mouseleave", "business-clusters", () => { clusterPopup.remove(); map.getCanvas().style.cursor = "crosshair"; });
    map.on("mouseenter", "business-points", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "business-points", () => { map.getCanvas().style.cursor = "crosshair"; });
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current);
    return () => { observer.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("radius") as GeoJSONSource).setData(radiusPolygon(point, radius));
    (map.getSource("selected") as GeoJSONSource).setData({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [point.lng, point.lat] } });
    const distance = Math.abs(map.getCenter().lng - point.lng) + Math.abs(map.getCenter().lat - point.lat);
    if (distance > 0.01) map.flyTo({ center: [point.lng, point.lat], zoom: 14.6, duration: 700 });
  }, [point, radius, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const collection: FeatureCollection<GeoPoint> = { type: "FeatureCollection", features: businesses.map(business => ({
      type: "Feature", properties: { osm_id: business.osm_id, color: colors[business.category] },
      geometry: { type: "Point", coordinates: [business.lng, business.lat] },
    })) };
    (map.getSource("businesses") as GeoJSONSource).setData(collection);
    (map.getSource("grouped-businesses") as GeoJSONSource).setData(collection);
  }, [businesses, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !focused) return;
    map.flyTo({ center: [focused.lng, focused.lat], duration: 500 });
    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = focused.name;
    const detail = document.createElement("p");
    detail.textContent = `${focused.category_label} · ${focused.distance_m} m geográficos`;
    content.append(title, detail);
    const popup = new maplibregl.Popup({ offset: 12 }).setLngLat([focused.lng, focused.lat]).setDOMContent(content).addTo(map);
    return () => { popup.remove(); };
  }, [focused, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const [layer, visible] of [
      ["business-points", mode === "points"], ["business-clusters", mode === "clusters"],
      ["business-unclustered", mode === "clusters"], ["business-heat", mode === "heat"],
      ["radius-fill", showRadius], ["radius-line", showRadius],
    ] as const) map.setLayoutProperty(layer, "visibility", visible ? "visible" : "none");
  }, [mode, showRadius, ready]);

  return <div className="map-stage">
    <div ref={container} className="map-canvas" data-ready={ready} aria-label="Mapa de Lima. Selecciona una ubicación con clic; también puedes usar el formulario de coordenadas." />
    <div className="map-layer-controls" role="group" aria-label="Capas del mapa">
      {([["points", "Puntos"], ["clusters", "Agrupaciones"], ["heat", "Mapa de calor"]] as const).map(([value, label]) => <button key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{label}</button>)}
      <button aria-pressed={showRadius} onClick={() => setShowRadius(value => !value)}>Radio</button>
      {mode === "heat" && <span className="heatmap-note">Concentración relativa de registros; cambia con el zoom. No es afluencia.</span>}
      <button onClick={() => mapRef.current?.flyTo({ center: [point.lng, point.lat], zoom: 14.6 })}>Centrar ubicación</button>
    </div>
    {!ready && !mapError && <div className="map-loading"><span className="spinner" /> Preparando el mapa…</div>}
    {mapError && <div className="map-error" role="alert">{mapError}<button onClick={() => setMapError(null)} aria-label="Cerrar aviso del mapa">×</button></div>}
  </div>;
}

