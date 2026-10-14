import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.services.overpass import OverpassClient, ProviderError


@pytest.mark.parametrize(
    "query",
    [
        "lat=-12&lng=-77&radius_m=300",
        "lat=91&lng=-77",
        "lat=nan&lng=-77",
        "lat=-12&lng=inf",
        "lat=-12&lng=-77&category=unknown",
        "lat=-12&lng=-77&injected=yes",
        "lat=0&lng=0",
        "lat=-12&lng=-77&search=" + "a" * 101,
    ],
)
def test_invalid_query_rejected_before_provider(query):
    with TestClient(create_app(Settings(database_url=None, rate_limit_per_minute=120))) as client:
        assert client.get(f"/api/v1/businesses/nearby?{query}").status_code == 422


def test_contract_and_health(osm_payload, monkeypatch):
    async def fetch(self, lat, lng, radius):
        return osm_payload

    monkeypatch.setattr(OverpassClient, "fetch", fetch)
    with TestClient(create_app(Settings(database_url=None))) as client:
        assert client.get("/health/ready").json()["cache"] == "memory"
        assert client.get("/api/v1/config").json()["radii_m"] == [250, 500, 1000]
        params = {"lat": -12.1211, "lng": -77.03, "radius_m": 250}
        response = client.get("/api/v1/businesses/nearby", params=params)
        assert response.status_code == 200
        data = response.json()
        assert data["total_in_radius"] == 4
        assert data["analysis"]["scope"] == "whole_radius"
        assert data["analysis"]["records_per_km2"] > 0
        assert data["source"]["provider"] == "OpenStreetMap / Overpass"
        assert data["source"]["distance_method"] == "haversine_straight_line"
        assert client.get("/api/v1/businesses/nearby", params=params).json()["source"]["cache_hit"]
        filtered = client.get(
            "/api/v1/businesses/nearby", params={**params, "category": "food"}
        ).json()
        assert filtered["analysis"] == data["analysis"]
        assert filtered["total_filtered"] < data["total_in_radius"]


def test_provider_failure_propagates_with_retry_after(monkeypatch):
    async def fetch(self, lat, lng, radius):
        raise ProviderError("Proveedor ocupado", retry_after=30)

    monkeypatch.setattr(OverpassClient, "fetch", fetch)
    with TestClient(create_app(Settings(database_url=None))) as client:
        response = client.get("/api/v1/businesses/nearby?lat=-12&lng=-77")
        assert response.status_code == 503
        assert response.headers["Retry-After"] == "30"
        assert "businesses" not in response.json()


def test_rate_limit():
    with TestClient(create_app(Settings(database_url=None, rate_limit_per_minute=1))) as client:
        assert client.get("/api/v1/businesses/nearby?lat=0&lng=0").status_code == 422
        response = client.get("/api/v1/businesses/nearby?lat=0&lng=0")
        assert response.status_code == 429
        assert response.headers["Retry-After"] == "60"
        assert client.get("/health/live").status_code == 200
