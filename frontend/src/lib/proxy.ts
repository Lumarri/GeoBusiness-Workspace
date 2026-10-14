import { NextResponse } from "next/server";

export async function proxy(path: "/api/v1/config" | "/api/v1/businesses/nearby", search = "") {
  try {
    const base = process.env.API_BASE_URL ?? "http://localhost:8000";
    const response = await fetch(`${base.replace(/\/$/, "")}${path}${search}`, {
      signal: AbortSignal.timeout(40_000), cache: "no-store",
    });
    const payload: unknown = await response.json();
    return NextResponse.json(payload, {
      status: response.status,
      headers: response.headers.has("Retry-After") ? { "Retry-After": response.headers.get("Retry-After")! } : {},
    });
  } catch {
    return NextResponse.json({ detail: "La API no está disponible. Verifica que el backend esté iniciado." }, { status: 503 });
  }
}

