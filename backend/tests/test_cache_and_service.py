from datetime import UTC, datetime, timedelta

from app.core.config import Settings
from app.db.cache import CacheEntry, MemoryCache, cache_key, make_entry
from app.schemas import Category, NearbyQuery
from app.services.nearby import NearbyService


async def test_ttl_eviction_and_coordinate_keys():
    cache = MemoryCache(max_entries=2)
    expired = CacheEntry(
        {}, datetime.now(UTC) - timedelta(hours=2), datetime.now(UTC) - timedelta(hours=1)
    )
    await cache.put("expired", expired, [])
    assert await cache.get("expired") is None
    for key in ("a", "b", "c"):
        await cache.put(key, make_entry({"elements": []}, 100), [])
    assert await cache.get("a") is None
    assert await cache.get("b") is not None
    assert cache_key(-12.1, -77, 250) != cache_key(-12.100001, -77, 250)
    assert cache_key(-12.1, -77, 250) != cache_key(-12.1, -77, 500)


async def test_filters_reuse_snapshot_and_do_not_change_totals(osm_payload):
    class Provider:
        calls = 0

        async def fetch(self, lat, lng, radius):
            self.calls += 1
            return osm_payload

    provider = Provider()
    service = NearbyService(MemoryCache(), provider, Settings())
    all_records = await service.query(NearbyQuery(lat=-12.1211, lng=-77.03, radius_m=250))
    filtered = await service.query(
        NearbyQuery(lat=-12.1211, lng=-77.03, radius_m=250, category=Category.FOOD, search="CAFE")
    )
    assert provider.calls == 1
    assert not all_records.source.cache_hit and filtered.source.cache_hit
    assert filtered.total_in_radius == 4 and filtered.total_filtered == 1
    assert filtered.source.retrieved_at == all_records.source.retrieved_at
    assert sum(c.count for c in filtered.categories) == 4
    assert filtered.businesses[0].name == "Café de prueba"
