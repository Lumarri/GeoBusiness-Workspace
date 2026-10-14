"""Explicit, bounded address searches; never autocomplete public Nominatim."""

import asyncio
import time

import httpx

from app.services.overpass import ProviderError


class GeocodingClient:
    def __init__(self, client: httpx.AsyncClient, url: str, bbox: tuple[float, ...]):
        self.client, self.url, self.bbox = client, url, bbox
        self.lock = asyncio.Lock()
        self.last_request = float("-inf")
        self.cache: dict[str, tuple[float, list[dict]]] = {}

    async def search(self, query: str) -> list[dict]:
        key = query.strip().casefold()
        cached = self.cache.get(key)
        if cached and cached[0] > time.monotonic():
            return cached[1]
        async with self.lock:
            cached = self.cache.get(key)
            if cached and cached[0] > time.monotonic():
                return cached[1]
            if time.monotonic() - self.last_request < 1:
                raise ProviderError("Espera un segundo entre búsquedas de dirección.", 429, 1)
            self.last_request = time.monotonic()
            west, south, east, north = self.bbox
            try:
                response = await self.client.get(
                    self.url,
                    params={
                        "q": query.strip(),
                        "format": "jsonv2",
                        "limit": 5,
                        "countrycodes": "pe",
                        "bounded": 1,
                        "viewbox": f"{west},{north},{east},{south}",
                    },
                )
                response.raise_for_status()
                payload = response.json()
                if not isinstance(payload, list):
                    raise TypeError("Invalid geocoder response")
                results = []
                for item in payload[:5]:
                    lat, lng = float(item["lat"]), float(item["lon"])
                    if west <= lng <= east and south <= lat <= north:
                        results.append({"label": str(item["display_name"]), "lat": lat, "lng": lng})
            except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
                raise ProviderError("No se pudo buscar la dirección. Intenta más tarde.") from exc
            # Bound memory even when many different searches are submitted.
            if len(self.cache) >= 128:
                self.cache.pop(next(iter(self.cache)))
            self.cache[key] = (time.monotonic() + 86400, results)
            return results
