import asyncio
import json
import math
import time
from typing import Any

import httpx

from app.services.businesses import AMENITIES


class ProviderError(Exception):
    def __init__(self, message: str, status_code: int = 503, retry_after: int = 30):
        super().__init__(message)
        self.status_code = status_code
        self.retry_after = retry_after


def build_query(lat: float, lng: float, radius: int) -> str:
    amenities = "|".join(sorted(AMENITIES))
    # Inputs have already been numerically validated, no user-supplied QL fragments.
    around = f"(around:{radius},{lat},{lng})"
    return (
        f"[out:json][timeout:25][maxsize:16777216];("
        f'nwr["shop"]{around};nwr["amenity"~"^({amenities})$"]{around};);out center;'
    )


class OverpassClient:
    MAX_BYTES = 8 * 1024 * 1024

    def __init__(self, client: httpx.AsyncClient, url: str, interval: float):
        self.client, self.url, self.interval = client, url, interval
        self.lock = asyncio.Lock()
        self.last_request = float("-inf")
        self.cooldown_until = float("-inf")

    async def fetch(self, lat: float, lng: float, radius: int) -> dict[str, Any]:
        if self.lock.locked():
            raise ProviderError(
                "Hay una consulta OSM en curso. Intenta de nuevo en unos segundos.", 429
            )
        async with self.lock:
            now = time.monotonic()
            next_allowed = max(self.last_request + self.interval, self.cooldown_until)
            if now < next_allowed:
                raise ProviderError(
                    "Pausa entre consultas para respetar al proveedor cartográfico.",
                    429,
                    max(1, math.ceil(next_allowed - now)),
                )
            self.last_request = now
            try:
                async with self.client.stream(
                    "POST", self.url, data={"data": build_query(lat, lng, radius)}
                ) as response:
                    if response.status_code in {429, 504}:
                        self.cooldown_until = time.monotonic() + 30
                        raise ProviderError(
                            "OSM está ocupado. Espera al menos 30 segundos antes de reintentar.",
                            503,
                        )
                    response.raise_for_status()
                    chunks = bytearray()
                    async for chunk in response.aiter_bytes():
                        chunks.extend(chunk)
                        if len(chunks) > self.MAX_BYTES:
                            raise ProviderError(
                                "La respuesta OSM supera el límite. Prueba un radio menor."
                            )
                payload = json.loads(chunks)
                if not isinstance(payload, dict) or not isinstance(payload.get("elements"), list):
                    raise ProviderError(
                        "Respuesta cartográfica inválida; no se mostrarán datos parciales."
                    )
                if payload.get("remark") or not isinstance(payload.get("osm3s", {}), dict):
                    raise ProviderError(
                        "La consulta OSM fue interrumpida; no se mostrarán datos parciales."
                    )
                return payload
            except (httpx.HTTPError, ValueError) as exc:
                raise ProviderError(
                    "No se pudo consultar OpenStreetMap. Intenta de nuevo más tarde."
                ) from exc
