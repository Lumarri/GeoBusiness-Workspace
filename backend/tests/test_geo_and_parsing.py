import math

import pytest

from app.schemas import Category
from app.services.businesses import category_for, parse_businesses
from app.services.geo import haversine_m


def test_known_geodesic_and_symmetry():
    assert haversine_m(0, 0, 0, 1) == pytest.approx(111_195.08, abs=0.1)
    assert haversine_m(-12, -77, -12, -77) == 0
    assert haversine_m(-12, -77, -13, -76) == pytest.approx(haversine_m(-13, -76, -12, -77))
    assert math.isfinite(haversine_m(0, 0, 0, 180))


@pytest.mark.parametrize(
    ("tags", "expected"),
    [
        ({"amenity": "restaurant"}, Category.FOOD),
        ({"shop": "supermarket"}, Category.GROCERIES),
        ({"amenity": "pharmacy", "shop": "chemist"}, Category.HEALTH),
        ({"shop": "hairdresser"}, Category.SERVICES),
        ({"shop": "clothes"}, Category.RETAIL),
    ],
)
def test_category_rules(tags, expected):
    assert category_for(tags) == expected


def test_parse_sorts_filters_and_preserves_provenance(osm_payload):
    osm_payload["elements"].append(osm_payload["elements"][0])
    businesses = parse_businesses(osm_payload, -12.1211, -77.03, 250)
    assert len(businesses) == 4
    assert [b.distance_m for b in businesses] == sorted(b.distance_m for b in businesses)
    assert (
        next(b for b in businesses if b.osm_id == "way/3").location_method == "bounding_box_center"
    )
    assert businesses[0].address == "Calle de prueba, 100"
    assert all(b.evidence == "osm_record" and b.distance_m <= 250 for b in businesses)


def test_malformed_and_inactive_elements_are_skipped(osm_payload):
    osm_payload["elements"].extend(
        [
            {"type": "node", "id": 7, "tags": {"shop": "bakery"}},
            {"type": "node", "id": 8, "lat": float("nan"), "lon": -77, "tags": {"shop": "bakery"}},
            {"type": "way", "id": 9, "center": None, "tags": {"shop": "clothes"}},
            {
                "type": "node",
                "id": 10,
                "lat": -12.1211,
                "lon": -77.03,
                "tags": {"shop": "bakery", "disused": "yes"},
            },
            {
                "type": "node",
                "id": 11,
                "lat": -12.1211,
                "lon": -77.03,
                "tags": {"shop": "bakery", "name": None},
            },
        ]
    )
    assert len(parse_businesses(osm_payload, -12.1211, -77.03, 250)) == 4


def test_exact_radius_rejection_uses_unrounded_distance():
    degrees = 250.04 / 6_371_008.8 * 180 / math.pi
    payload = {
        "elements": [
            {"type": "node", "id": 1, "lat": degrees, "lon": 0, "tags": {"shop": "bakery"}}
        ]
    }
    assert parse_businesses(payload, 0, 0, 250) == []
