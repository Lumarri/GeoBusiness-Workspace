import asyncio
import hashlib
import json
from collections import OrderedDict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

from geoalchemy2 import WKTElement
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

from app.db.models import BusinessObservation, QueryCache
from app.schemas import Business


@dataclass(frozen=True)
class CacheEntry:
    payload: dict[str, Any]
    retrieved_at: datetime
    expires_at: datetime


def cache_key(lat: float, lng: float, radius: int) -> str:
    # Exact coordinates; no grid rounding that could move the analysis radius.
    serialized = json.dumps(["osm-v1", lat, lng, radius], separators=(",", ":"))
    return hashlib.sha256(serialized.encode()).hexdigest()


def make_entry(payload: dict[str, Any], ttl: int) -> CacheEntry:
    now = datetime.now(UTC)
    return CacheEntry(payload=payload, retrieved_at=now, expires_at=now + timedelta(seconds=ttl))


class Cache(Protocol):
    async def get(self, key: str) -> CacheEntry | None: ...
    async def put(self, key: str, entry: CacheEntry, businesses: list[Business]) -> None: ...


class MemoryCache:
    """Native development/tests only: bounded LRU, without durable observations."""

    def __init__(self, max_entries: int = 16):
        self.entries: OrderedDict[str, CacheEntry] = OrderedDict()
        self.max_entries = max_entries

    async def get(self, key: str) -> CacheEntry | None:
        entry = self.entries.get(key)
        if entry and entry.expires_at > datetime.now(UTC):
            self.entries.move_to_end(key)
            return entry
        self.entries.pop(key, None)
        return None

    async def put(self, key: str, entry: CacheEntry, businesses: list[Business]) -> None:
        self.entries[key] = entry
        self.entries.move_to_end(key)
        while len(self.entries) > self.max_entries:
            self.entries.popitem(last=False)


class PostgresCache:
    def __init__(self, engine: AsyncEngine):
        self.session = async_sessionmaker(engine, expire_on_commit=False)
        self.last_cleanup = datetime.min.replace(tzinfo=UTC)
        self.cleanup_lock = asyncio.Lock()

    async def get(self, key: str) -> CacheEntry | None:
        async with self.session() as session:
            row = await session.scalar(
                select(QueryCache).where(
                    QueryCache.key == key, QueryCache.expires_at > datetime.now(UTC)
                )
            )
            return CacheEntry(row.payload, row.retrieved_at, row.expires_at) if row else None

    async def put(self, key: str, entry: CacheEntry, businesses: list[Business]) -> None:
        async with self.session.begin() as session:
            values = {
                "key": key,
                "payload": entry.payload,
                "retrieved_at": entry.retrieved_at,
                "expires_at": entry.expires_at,
            }
            stmt = insert(QueryCache).values(**values)
            await session.execute(
                stmt.on_conflict_do_update(index_elements=[QueryCache.key], set_=values)
            )
            # Batch to bound PostgreSQL bind parameters even in dense urban areas.
            for offset in range(0, len(businesses), 500):
                observations = [
                    {
                        "osm_id": b.osm_id,
                        "name": b.name,
                        "category": b.category.value,
                        "location": WKTElement(f"POINT({b.lng} {b.lat})", srid=4326),
                        "retrieved_at": entry.retrieved_at,
                        "record": b.model_dump(mode="json"),
                    }
                    for b in businesses[offset : offset + 500]
                ]
                stmt = insert(BusinessObservation).values(observations)
                await session.execute(
                    stmt.on_conflict_do_update(
                        index_elements=[BusinessObservation.osm_id],
                        set_={
                            key: getattr(stmt.excluded, key)
                            for key in ("name", "category", "location", "retrieved_at", "record")
                        },
                        where=BusinessObservation.retrieved_at <= stmt.excluded.retrieved_at,
                    )
                )
        if entry.retrieved_at - self.last_cleanup > timedelta(hours=1):
            async with self.cleanup_lock:
                async with self.session.begin() as session:
                    await session.execute(
                        delete(QueryCache).where(QueryCache.expires_at <= entry.retrieved_at)
                    )
                self.last_cleanup = entry.retrieved_at
