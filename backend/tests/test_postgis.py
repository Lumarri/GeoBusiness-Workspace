import os
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.cache import PostgresCache, make_entry
from app.services.businesses import parse_businesses


@pytest.mark.skipif(
    not os.getenv("TEST_DATABASE_URL"), reason="TEST_DATABASE_URL is not configured"
)
async def test_postgis_roundtrip_and_spatial_query(osm_payload):
    """Run against a disposable PostGIS database initialized with 001_schema.sql."""
    engine = create_async_engine(os.environ["TEST_DATABASE_URL"])
    key = uuid.uuid4().hex
    businesses = parse_businesses(osm_payload, -12.1211, -77.03, 250)
    for business in businesses:
        business.osm_id = f"test/{key}/{business.osm_id}"
    try:
        cache = PostgresCache(engine)
        assert await cache.get(key) is None
        await cache.put(key, make_entry(osm_payload, 60), businesses)
        assert (await cache.get(key)).payload == osm_payload
        await cache.put(key, make_entry(osm_payload, 60), businesses)
        async with engine.connect() as connection:
            result = await connection.execute(
                text("""
                SELECT count(*) FROM business_observations
                WHERE osm_id LIKE :pattern AND ST_DWithin(
                    location, ST_SetSRID(ST_MakePoint(:lng,:lat),4326)::geography, :radius)
            """),
                {"pattern": f"test/{key}/%", "lat": -12.1211, "lng": -77.03, "radius": 250},
            )
            assert result.scalar() == 4
    finally:
        async with engine.begin() as connection:
            await connection.execute(text("DELETE FROM query_cache WHERE key = :key"), {"key": key})
            await connection.execute(
                text("DELETE FROM business_observations WHERE osm_id LIKE :pattern"),
                {"pattern": f"test/{key}/%"},
            )
        await engine.dispose()
