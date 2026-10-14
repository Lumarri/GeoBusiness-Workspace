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


// Move along a great circle; useful for accessible, small marker adjustments.
export function offsetPoint(point: Point, bearingDegrees: number, meters = 1): Point {
  const lat = point.lat * Math.PI / 180, lng = point.lng * Math.PI / 180;
  const bearing = bearingDegrees * Math.PI / 180, d = meters / 6371008.8;
  const nextLat = Math.asin(Math.max(-1, Math.min(1, Math.sin(lat) * Math.cos(d) + Math.cos(lat) * Math.sin(d) * Math.cos(bearing))));
  const nextLng = lng + Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(lat), Math.cos(d) - Math.sin(lat) * Math.sin(nextLat));
  return { lat: nextLat * 180 / Math.PI, lng: ((nextLng * 180 / Math.PI + 540) % 360) - 180 };
}
