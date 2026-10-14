import type { Feature, Polygon } from "geojson";
import type { Point } from "./types";

export function radiusPolygon(point: Point, radiusM: number, steps = 96): Feature<Polygon> {
  const latitude = point.lat * Math.PI / 180;
  const longitude = point.lng * Math.PI / 180;
  const angular = radiusM / 6_371_008.8;
  const ring: number[][] = [];
  for (let i = 0; i < steps; i++) {
    const bearing = i * 2 * Math.PI / steps;
    const lat = Math.asin(Math.sin(latitude) * Math.cos(angular) + Math.cos(latitude) * Math.sin(angular) * Math.cos(bearing));
    const lng = longitude + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(latitude), Math.cos(angular) - Math.sin(latitude) * Math.sin(lat));
    ring.push([lng * 180 / Math.PI, lat * 180 / Math.PI]);
  }
  ring.push([...ring[0]]);
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
}

export function withinRegion(point: Point, bbox: [number, number, number, number]): boolean {
  const [west, south, east, north] = bbox;
  return Number.isFinite(point.lat) && Number.isFinite(point.lng) &&
    point.lng >= west && point.lng <= east && point.lat >= south && point.lat <= north;
}

