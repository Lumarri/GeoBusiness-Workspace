"""Public prototype weather adapter. Grid/model data is not parcel-level evidence."""

import asyncio
import time
from datetime import UTC, datetime

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.services.overpass import ProviderError


class CurrentWeather(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    time: str
    temperature_2m: float | None
    relative_humidity_2m: float | None = Field(ge=0, le=100)
    precipitation: float | None = Field(ge=0)
    weather_code: int | None
    wind_speed_10m: float | None = Field(ge=0)


class WeatherClient:
    def __init__(self, client: httpx.AsyncClient):
        self.client = client
        self.lock = asyncio.Lock()
        self.cache: dict[tuple[float, float], tuple[float, dict]] = {}

    async def get(self, lat: float, lng: float) -> dict:
        key = (round(lat, 4), round(lng, 4))
        async with self.lock:
            cached = self.cache.get(key)
            if cached and cached[0] > time.monotonic():
                return {**cached[1], "cache_hit": True}
            try:
                response = await self.client.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={
                        "latitude": key[0],
                        "longitude": key[1],
                        "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
                        "timezone": "America/Lima",
                        "wind_speed_unit": "kmh",
                    },
                    timeout=15,
                )
                response.raise_for_status()
                payload = response.json()
                current = CurrentWeather.model_validate(payload["current"])
                # Provider time explicitly belongs to the requested Lima timezone.
                datetime.fromisoformat(current.time)
                result = {
                    "current": current.model_dump(),
                    "timezone": "America/Lima",
                    "provider": "Open-Meteo",
                    "source_url": "https://open-meteo.com/",
                    "retrieved_at": datetime.now(UTC).isoformat(),
                    "cache_hit": False,
                    "units": {
                        "temperature": "°C",
                        "humidity": "%",
                        "precipitation": "mm",
                        "wind": "km/h",
                    },
                    "limitations": "Datos meteorológicos de modelo/celda; no una medición en este local.",
                }
            except (httpx.HTTPError, ValueError, TypeError, KeyError, ValidationError) as exc:
                raise ProviderError("No se pudo obtener el clima. Intenta más tarde.") from exc
            if len(self.cache) >= 128:
                self.cache.pop(next(iter(self.cache)))
            self.cache[key] = (time.monotonic() + 300, result)
            return result
