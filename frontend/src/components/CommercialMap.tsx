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
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => { callbacks.current = { onSelect, onBusinessSelect }; records.current = businesses; }, [onSelect, onBusinessSelect, businesses]);

  useEffect(() => {
    if (!container.current) return;
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
    map.on("load", () => {
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
      setReady(true);
    });
    map.on("error", () => setMapError("El proveedor no pudo cargar parte del mapa. Verifica tu conexión o configura otro proveedor de teselas."));
    map.on("click", event => {
      const matches = map.getLayer("business-points") ? map.queryRenderedFeatures(event.point, { layers: ["business-points"] }) : [];
      if (matches.length) {
        const business = records.current.find(item => item.osm_id === matches[0].properties.osm_id);
        if (business) callbacks.current.onBusinessSelect(business);
      } else {
        callbacks.current.onSelect({ lat: event.lngLat.lat, lng: event.lngLat.wrap().lng });
      }
    });
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

  return <div className="map-stage">
    <div ref={container} className="map-canvas" aria-label="Mapa de Lima. Selecciona una ubicación con clic; también puedes usar el formulario de coordenadas." />
    {!ready && !mapError && <div className="map-loading"><span className="spinner" /> Preparando el mapa…</div>}
    {mapError && <div className="map-error" role="alert">{mapError}<button onClick={() => setMapError(null)} aria-label="Cerrar aviso del mapa">×</button></div>}
  </div>;
}

