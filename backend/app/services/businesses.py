import math
import unicodedata
from collections import Counter
from typing import Any

from app.schemas import CATEGORY_LABELS, Business, Category, CategoryCount
from app.services.geo import haversine_m

AMENITIES = {
    "restaurant",
    "cafe",
    "fast_food",
    "bar",
    "pub",
    "ice_cream",
    "food_court",
    "pharmacy",
    "clinic",
    "dentist",
    "doctors",
    "veterinary",
    "bank",
    "fuel",
    "car_wash",
    "bureau_de_change",
}


def category_for(tags: dict[str, str]) -> Category:
    amenity, shop = tags.get("amenity"), tags.get("shop")
    if amenity in {"pharmacy", "clinic", "dentist", "doctors", "veterinary"}:
        return Category.HEALTH
    if amenity in {"restaurant", "cafe", "fast_food", "bar", "pub", "ice_cream", "food_court"}:
        return Category.FOOD
    if shop in {
        "supermarket",
        "convenience",
        "bakery",
        "greengrocer",
        "butcher",
        "seafood",
        "deli",
        "kiosk",
    }:
        return Category.GROCERIES
    if amenity in {"bank", "fuel", "car_wash", "bureau_de_change"} or shop in {
        "hairdresser",
        "beauty",
        "laundry",
        "car_repair",
        "travel_agency",
        "copyshop",
    }:
        return Category.SERVICES
    return Category.RETAIL if shop else Category.OTHER


def normalize_search(value: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", value.casefold()) if not unicodedata.combining(c)
    )


def parse_businesses(
    payload: dict[str, Any], lat: float, lng: float, radius: int
) -> list[Business]:
    records: dict[str, Business] = {}
    for element in payload["elements"]:
        if not isinstance(element, dict):
            continue
        tags = element.get("tags", {})
        if not isinstance(tags, dict) or not all(isinstance(v, str) for v in tags.values()):
            continue
        if tags.get("shop") in {"no", "vacant", "disused"}:
            continue
        if any(tags.get(key) == "yes" for key in ("disused", "abandoned", "demolished")):
            continue
        if not tags.get("shop") and tags.get("amenity") not in AMENITIES:
            continue
        kind = element.get("type")
        if kind not in {"node", "way", "relation"} or not isinstance(element.get("id"), int):
            continue
        coordinate = element if kind == "node" else element.get("center", {})
        if not isinstance(coordinate, dict):
            continue
        try:
            plat, plng = float(coordinate["lat"]), float(coordinate["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        if not (
            math.isfinite(plat)
            and math.isfinite(plng)
            and -90 <= plat <= 90
            and -180 <= plng <= 180
        ):
            continue
        distance = haversine_m(lat, lng, plat, plng)
        if distance > radius:
            continue
        category = category_for(tags)
        address_parts = [
            tags[k] for k in ("addr:street", "addr:housenumber", "addr:district") if tags.get(k)
        ]
        osm_id = f"{kind}/{element['id']}"
        records[osm_id] = Business(
            osm_id=osm_id,
            osm_type=kind,
            name=tags.get("name") or tags.get("brand") or "Establecimiento sin nombre en OSM",
            category=category,
            category_label=CATEGORY_LABELS[category],
            subtype=tags.get("shop") or tags.get("amenity", "unknown"),
            lat=plat,
            lng=plng,
            distance_m=round(distance, 1),
            location_method="node" if kind == "node" else "bounding_box_center",
            address=", ".join(address_parts) or tags.get("addr:full"),
            opening_hours=tags.get("opening_hours"),
            osm_url=f"https://www.openstreetmap.org/{osm_id}",
        )
    return sorted(records.values(), key=lambda record: (record.distance_m, record.osm_id))


def category_counts(records: list[Business]) -> list[CategoryCount]:
    counts = Counter(record.category for record in records)
    return [
        CategoryCount(category=category, label=CATEGORY_LABELS[category], count=counts[category])
        for category in Category
    ]
