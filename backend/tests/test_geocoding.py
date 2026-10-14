import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.services.geocoding import GeocodingClient
from app.services.overpass import ProviderError

BBOX = (-77.25, -12.4, -76.65, -11.65)


async def test_bounded_search_cache_and_outside_results():
    calls = []

    def handler(request):
        calls.append(request)
        assert request.url.params["bounded"] == "1"
        assert request.url.params["countrycodes"] == "pe"
        return httpx.Response(
            200,
            json=[
                {"lat": "-12.12", "lon": "-77.03", "display_name": "Parque Kennedy"},
                {"lat": "0", "lon": "0", "display_name": "Fuera de Lima"},
            ],
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        service = GeocodingClient(client, "https://example.com/search", BBOX)
        results = await service.search(" Kennedy ")
        assert len(results) == 1
        assert await service.search("kennedy") == results
        assert len(calls) == 1
        with pytest.raises(ProviderError) as error:
            await service.search("Otro lugar")
        assert error.value.status_code == 429


@pytest.mark.parametrize("payload", [{}, [{"lat": "bad"}], [None]])
async def test_malformed_response_is_provider_error(payload):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json=payload))
    ) as client:
        with pytest.raises(ProviderError):
            await GeocodingClient(client, "https://example.com/search", BBOX).search("Kennedy")


async def test_provider_failure():
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(429))
    ) as client:
        with pytest.raises(ProviderError):
            await GeocodingClient(client, "https://example.com/search", BBOX).search("Kennedy")


def test_search_api_validation_and_contract(monkeypatch):
    async def search(self, query):
        return [{"label": "Kennedy", "lat": -12.12, "lng": -77.03}]

    monkeypatch.setattr(GeocodingClient, "search", search)
    with TestClient(create_app(Settings(database_url=None))) as client:
        for q in ["ab", "   ", "a" * 161]:
            assert client.get("/api/v1/locations/search", params={"q": q}).status_code == 422
        response = client.get("/api/v1/locations/search", params={"q": "Kennedy"})
        assert response.status_code == 200
        assert response.json()["results"][0]["label"] == "Kennedy"
        assert response.json()["provider"] == "OpenStreetMap / Nominatim"
