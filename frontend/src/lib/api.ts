import { nearbySchema, regionSchema, type Point, type Radius } from "./types";

export class ApiError extends Error {
  constructor(message: string, public readonly retryAfter: number | null = null) { super(message); }
}

async function read(response: Response): Promise<unknown> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof payload === "object" && payload !== null && "detail" in payload ? payload.detail : null;
    const retry = Number(response.headers.get("Retry-After"));
    throw new ApiError(typeof detail === "string" ? detail : "No se pudo completar la consulta. Verifica la ubicación y la conexión.", retry > 0 ? retry : null);
  }
  return payload;
}

export async function getRegion(signal?: AbortSignal) {
  return regionSchema.parse(await read(await fetch("/api/v1/config", { signal })));
}

export async function getNearby(point: Point, radius: Radius, signal: AbortSignal) {
  const params = new URLSearchParams({ lat: String(point.lat), lng: String(point.lng), radius_m: String(radius) });
  return nearbySchema.parse(await read(await fetch(`/api/v1/businesses/nearby?${params}`, { signal })));
}

