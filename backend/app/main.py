import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import create_async_engine

from app.api.routes import router
from app.core.config import Settings
from app.core.limits import RateLimiter
from app.db.cache import MemoryCache, PostgresCache
from app.services.nearby import NearbyService
from app.services.overpass import OverpassClient, ProviderError

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        engine = (
            create_async_engine(settings.database_url, pool_pre_ping=True)
            if settings.database_url
            else None
        )
        try:
            if engine:
                # Schema installed by database/init/001_schema.sql, not by request handlers.
                async with engine.connect() as connection:
                    await connection.execute(text("SELECT key FROM query_cache LIMIT 0"))
                    await connection.execute(text("SELECT PostGIS_Version()"))
            cache = PostgresCache(engine) if engine else MemoryCache()
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(35, connect=10),
                headers={"User-Agent": settings.osm_user_agent},
                follow_redirects=False,
            ) as client:
                app.state.nearby = NearbyService(
                    cache,
                    OverpassClient(
                        client, str(settings.overpass_url), settings.provider_interval_seconds
                    ),
                    settings,
                )
                app.state.engine = engine
                yield
        finally:
            if engine:
                await engine.dispose()

    app = FastAPI(title="GeoBusiness AI", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET"],
        allow_headers=["Content-Type"],
        expose_headers=["Retry-After"],
    )
    limiter = RateLimiter(settings.rate_limit_per_minute)

    @app.middleware("http")
    async def limit_requests(request: Request, call_next):
        if request.url.path == "/api/v1/businesses/nearby":
            key = request.client.host if request.client else "unknown"
            if not limiter.allow(key):
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Límite de consultas alcanzado. Espera un minuto."},
                    headers={"Retry-After": "60"},
                )
        return await call_next(request)

    @app.exception_handler(ProviderError)
    async def provider_error(request: Request, exc: ProviderError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": str(exc)},
            headers={"Retry-After": str(exc.retry_after)},
        )

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request: Request, exc: SQLAlchemyError):
        logger.error("Database operation failed: %s", type(exc).__name__)
        return JSONResponse(
            status_code=503, content={"detail": "La base de datos no está disponible."}
        )

    @app.get("/health/live")
    async def live():
        return {"status": "ok"}

    @app.get("/health/ready")
    async def ready(request: Request):
        engine = request.app.state.engine
        if engine:
            async with engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
        return {"status": "ok", "cache": "postgresql" if engine else "memory"}

    app.include_router(router)
    return app


app = create_app()
