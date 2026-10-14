import math

from pydantic import Field, HttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str | None = None
    overpass_url: HttpUrl = "https://overpass-api.de/api/interpreter"
    geocoding_url: HttpUrl = "https://nominatim.openstreetmap.org/search"
    osm_user_agent: str = "GeoBusinessAI/0.1 (local-development)"
    cache_ttl_seconds: int = Field(default=86400, ge=60, le=604800)
    provider_interval_seconds: float = Field(default=3, ge=0, le=60)
    rate_limit_per_minute: int = Field(default=12, ge=1, le=120)
    cors_origins: list[str] = ["http://localhost:3000"]
    # Configurable regional extent: [west, south, east, north], not a legal boundary.
    region_bbox: tuple[float, float, float, float] = (-77.25, -12.40, -76.65, -11.65)
    region_name: str = "Lima Metropolitana"

    @field_validator("region_bbox")
    @classmethod
    def validate_bbox(cls, value: tuple[float, float, float, float]):
        west, south, east, north = value
        if not all(math.isfinite(c) for c in value) or not (
            -180 <= west < east <= 180 and -90 <= south < north <= 90
        ):
            raise ValueError(
                "REGION_BBOX must be [west,south,east,north] with finite ordered bounds"
            )
        return value
