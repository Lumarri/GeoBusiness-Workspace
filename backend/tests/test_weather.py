import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.services.overpass import ProviderError
from app.services.weather import WeatherClient

PAYLOAD = {
    "current": {
        "time": "2026-10-14T10:00",
        "temperature_2m": 21.2,
        "relative_humidity_2m": 80,
        "precipitation": 0,
        "weather_code": 1,
        "wind_speed_10m": 12,
    }
}


async def test_weather_cache_units_and_lima_time():
    calls = []

    def handler(request):
        calls.append(request)
        assert request.url.params["timezone"] == "America/Lima"
        return httpx.Response(200, json=PAYLOAD)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        service = WeatherClient(client)
        first = await service.get(-12.1211, -77.03)
        second = await service.get(-12.1211, -77.03)
        assert first["current"]["precipitation"] == 0
        assert first["units"]["temperature"] == "°C"
        assert not first["cache_hit"] and second["cache_hit"]
        assert len(calls) == 1


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"current": {"time": "not-a-date"}},
        {"current": {**PAYLOAD["current"], "relative_humidity_2m": 101}},
    ],
)
async def test_invalid_weather_is_not_fabricated(payload):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json=payload))
    ) as client:
        with pytest.raises(ProviderError):
            await WeatherClient(client).get(-12.12, -77.03)


def test_weather_api_bounds_and_error_contract(monkeypatch):
    async def get(self, lat, lng):
        raise ProviderError("Clima no disponible")

    monkeypatch.setattr(WeatherClient, "get", get)
    with TestClient(create_app(Settings(database_url=None))) as client:
        for query in ["lat=0&lng=0", "lat=nan&lng=-77", "lat=-12&lng=inf", "lat=91&lng=-77"]:
            assert client.get(f"/api/v1/weather?{query}").status_code == 422
        response = client.get("/api/v1/weather?lat=-12.12&lng=-77.03")
        assert response.status_code == 503
        assert response.json()["detail"] == "Clima no disponible"
