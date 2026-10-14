"""Descriptive metrics for the full OSM snapshot, never economic predictions."""

import ctypes
import math
import os
from collections import Counter
from functools import lru_cache
from pathlib import Path

from app.schemas import Business, TerritorialAnalysis
from app.services.geo import haversine_m

MAX_SPATIAL_RECORDS = 2000


@lru_cache(maxsize=1)
def native_library():
    name = "geobusiness.dll" if os.name == "nt" else "libgeobusiness.so"
    path = Path(__file__).resolve().parents[2] / "native" / name
    try:
        library = ctypes.CDLL(str(path))
        library.gb_spatial.argtypes = [
            ctypes.POINTER(ctypes.c_double),
            ctypes.POINTER(ctypes.c_double),
            ctypes.c_size_t,
            ctypes.c_double,
            ctypes.POINTER(ctypes.c_double),
            ctypes.POINTER(ctypes.c_double),
        ]
        library.gb_spatial.restype = ctypes.c_int
        return library
    except (OSError, AttributeError):
        return None


def spatial_metrics(records: list[Business]):
    count = len(records)
    if count < 2 or count > MAX_SPATIAL_RECORDS:
        return None, None, "not_computed"
    library = native_library()
    if library is not None:
        array = ctypes.c_double * count
        lat = array(*(r.lat for r in records))
        lng = array(*(r.lng for r in records))
        mean, fraction = ctypes.c_double(), ctypes.c_double()
        status = library.gb_spatial(
            lat, lng, count, 50.0, ctypes.byref(mean), ctypes.byref(fraction)
        )
        if status == 0:
            return mean.value, fraction.value, "cpp"
    # Exact reference implementation for machines without a C++ toolchain.
    distances = [
        min(haversine_m(a.lat, a.lng, b.lat, b.lng) for j, b in enumerate(records) if i != j)
        for i, a in enumerate(records)
    ]
    return sum(distances) / count, sum(d <= 50 for d in distances) / count, "python"


def analyze(records: list[Business], radius_m: int) -> TerritorialAnalysis:
    count = len(records)
    area = math.pi * (radius_m / 1000) ** 2
    categories = Counter(r.category for r in records)
    dominant = categories.most_common(1)[0] if count else None
    diversity = (
        -sum((n / count) * math.log(n / count) for n in categories.values()) / math.log(6)
        if count
        else None
    )
    nearest, close, engine = spatial_metrics(records)
    return TerritorialAnalysis(
        area_km2=round(area, 4),
        records_per_km2=round(count / area, 1),
        diversity_index=round(diversity, 3) if diversity is not None else None,
        dominant_category=(
            dominant[0]
            if dominant and sum(n == dominant[1] for n in categories.values()) == 1
            else None
        ),
        dominant_share=round(dominant[1] / count, 3) if dominant else None,
        mean_nearest_neighbor_m=round(nearest, 1) if nearest is not None else None,
        share_with_neighbor_50m=round(close, 3) if close is not None else None,
        named_share=round(
            sum(r.name != "Establecimiento sin nombre en OSM" for r in records) / count, 3
        )
        if count
        else None,
        addressed_share=round(sum(bool(r.address) for r in records) / count, 3) if count else None,
        hours_share=round(sum(bool(r.opening_hours) for r in records) / count, 3)
        if count
        else None,
        spatial_engine=engine,
    )
