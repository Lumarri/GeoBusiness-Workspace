import asyncio

from app.core.config import Settings
from app.db.cache import Cache, cache_key, make_entry
from app.schemas import NearbyQuery, NearbyResponse, SourceMetadata
from app.services.analytics import analyze
from app.services.businesses import category_counts, normalize_search, parse_businesses
from app.services.overpass import OverpassClient


class NearbyService:
    def __init__(self, cache: Cache, provider: OverpassClient, settings: Settings):
        self.cache, self.provider, self.settings = cache, provider, settings

    async def query(self, query: NearbyQuery) -> NearbyResponse:
        key = cache_key(query.lat, query.lng, query.radius_m)
        entry = await self.cache.get(key)
        cache_hit = entry is not None
        if entry is None:
            payload = await self.provider.fetch(query.lat, query.lng, query.radius_m)
            records = parse_businesses(payload, query.lat, query.lng, query.radius_m)
            entry = make_entry(payload, self.settings.cache_ttl_seconds)
            await self.cache.put(key, entry, records)
        else:
            records = parse_businesses(entry.payload, query.lat, query.lng, query.radius_m)
        search = normalize_search(query.search.strip())
        filtered = [
            record
            for record in records
            if (not query.category or record.category == query.category)
            and (
                not search
                or search
                in normalize_search(f"{record.name} {record.address or ''} {record.subtype}")
            )
        ]
        return NearbyResponse(
            location={"lat": query.lat, "lng": query.lng},
            radius_m=query.radius_m,
            region=self.settings.region_name,
            total_in_radius=len(records),
            total_filtered=len(filtered),
            categories=category_counts(records),
            businesses=filtered,
            analysis=await asyncio.to_thread(analyze, records, query.radius_m),
            source=SourceMetadata(
                retrieved_at=entry.retrieved_at,
                cache_expires_at=entry.expires_at,
                cache_hit=cache_hit,
                osm_base_timestamp=entry.payload.get("osm3s", {}).get("timestamp_osm_base"),
            ),
        )
