from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request

from app.schemas import CATEGORY_LABELS, NearbyQuery, NearbyResponse

router = APIRouter(prefix="/api/v1")


@router.get("/config")
async def config(request: Request):
    settings = request.app.state.settings
    return {
        "region": settings.region_name,
        "bbox": settings.region_bbox,
        "radii_m": [250, 500, 1000],
        "categories": [{"id": key, "label": label} for key, label in CATEGORY_LABELS.items()],
    }


@router.get("/businesses/nearby", response_model=NearbyResponse)
async def nearby(request: Request, query: Annotated[NearbyQuery, Query()]):
    west, south, east, north = request.app.state.settings.region_bbox
    if not (west <= query.lng <= east and south <= query.lat <= north):
        raise HTTPException(422, detail="La ubicación está fuera de la región habilitada.")
    return await request.app.state.nearby.query(query)


@router.get("/locations/search")
async def search_locations(
    request: Request, q: Annotated[str, Query(min_length=3, max_length=160)]
):
    if len(q.strip()) < 3:
        raise HTTPException(422, detail="Escribe al menos tres caracteres.")
    return {
        "results": await request.app.state.geocoding.search(q),
        "provider": "OpenStreetMap / Nominatim",
        "license": "ODbL-1.0",
    }
