from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Category(StrEnum):
    FOOD = "food"
    GROCERIES = "groceries"
    HEALTH = "health"
    RETAIL = "retail"
    SERVICES = "services"
    OTHER = "other"


CATEGORY_LABELS = {
    Category.FOOD: "Restaurantes y cafés",
    Category.GROCERIES: "Alimentos y mercados",
    Category.HEALTH: "Salud y farmacias",
    Category.RETAIL: "Comercio minorista",
    Category.SERVICES: "Servicios",
    Category.OTHER: "Otros establecimientos",
}


class NearbyQuery(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, extra="forbid")
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    radius_m: int = Field(default=500, json_schema_extra={"enum": [250, 500, 1000]})
    category: Category | None = None
    search: str = Field(default="", max_length=100)

    @field_validator("radius_m")
    @classmethod
    def allowed_radius(cls, value: int) -> int:
        if value not in (250, 500, 1000):
            raise ValueError("El radio debe ser 250, 500 o 1000 metros")
        return value


class Business(BaseModel):
    osm_id: str
    osm_type: Literal["node", "way", "relation"]
    name: str
    category: Category
    category_label: str
    subtype: str
    lat: float
    lng: float
    distance_m: float
    location_method: Literal["node", "bounding_box_center"]
    address: str | None
    opening_hours: str | None
    osm_url: str
    evidence: Literal["osm_record"] = "osm_record"


class CategoryCount(BaseModel):
    category: Category
    label: str
    count: int


class SourceMetadata(BaseModel):
    provider: Literal["OpenStreetMap / Overpass"] = "OpenStreetMap / Overpass"
    license: Literal["ODbL-1.0"] = "ODbL-1.0"
    retrieved_at: datetime
    osm_base_timestamp: str | None = None
    cache_hit: bool
    cache_expires_at: datetime
    distance_method: Literal["haversine_straight_line"] = "haversine_straight_line"
    limitations: list[str] = [
        "OSM es colaborativo: la cobertura puede ser incompleta o desactualizada.",
        "Un registro OSM no verifica que el negocio siga operando; 0 registros no implica 0 negocios.",
        "Se deduplican IDs OSM, no negocios físicos etiquetados varias veces.",
        "Las distancias son geográficas, no rutas ni tiempos a pie. Áreas usan el centro de su caja envolvente.",
        "No se infieren demanda, ventas, rentabilidad ni competencia directa.",
    ]


class NearbyResponse(BaseModel):
    location: dict[str, float]
    radius_m: int
    region: str
    total_in_radius: int
    total_filtered: int
    categories: list[CategoryCount]
    businesses: list[Business]
    source: SourceMetadata
