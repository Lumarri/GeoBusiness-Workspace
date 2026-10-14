import pytest


@pytest.fixture
def osm_payload():
    """Synthetic OSM-shaped fixture; never loaded by the application."""
    return {
        "osm3s": {"timestamp_osm_base": "2026-10-13T00:00:00Z"},
        "elements": [
            {
                "type": "node",
                "id": 1,
                "lat": -12.1211,
                "lon": -77.0301,
                "tags": {
                    "name": "Café de prueba",
                    "amenity": "cafe",
                    "addr:street": "Calle de prueba",
                    "addr:housenumber": "100",
                },
            },
            {
                "type": "node",
                "id": 2,
                "lat": -12.1221,
                "lon": -77.0300,
                "tags": {"name": "Farmacia de prueba", "amenity": "pharmacy"},
            },
            {
                "type": "way",
                "id": 3,
                "center": {"lat": -12.1231, "lon": -77.0300},
                "tags": {"shop": "supermarket", "name": "Mercado de prueba"},
            },
            {
                "type": "relation",
                "id": 4,
                "center": {"lat": -12.1211, "lon": -77.0310},
                "tags": {"shop": "clothes"},
            },
            {
                "type": "node",
                "id": 5,
                "lat": -12.2,
                "lon": -77.03,
                "tags": {"shop": "bakery", "name": "Fuera del radio"},
            },
            {"type": "node", "id": 6, "lat": -12.1211, "lon": -77.03, "tags": {"shop": "vacant"}},
        ],
    }
