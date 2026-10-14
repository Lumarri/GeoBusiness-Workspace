import ctypes
import math

import pytest

from app.schemas import Category
from app.services import analytics
from app.services.businesses import parse_businesses
from app.services.geo import haversine_m


def records(payload):
    return parse_businesses(payload, -12.1211, -77.03, 1000)


def test_metrics_and_empty_data(osm_payload):
    result = analytics.analyze(records(osm_payload), 250)
    assert result.scope == "whole_radius"
    assert result.records_per_km2 == round(4 / (math.pi * 0.25**2), 1)
    assert 0 <= result.diversity_index <= 1
    assert 0 <= result.share_with_neighbor_50m <= 1
    assert result.mean_nearest_neighbor_m >= 0
    empty = analytics.analyze([], 250)
    assert empty.records_per_km2 == 0
    assert empty.diversity_index is None
    assert empty.dominant_category is None
    assert empty.named_share is None
    assert empty.mean_nearest_neighbor_m is None


def test_native_and_python_agree(osm_payload, monkeypatch):
    native = analytics.native_library()
    if native is None:
        pytest.skip("Build the native engine with scripts/build-native.sh first")
    points = records(osm_payload)
    cpp_mean, cpp_close, engine = analytics.spatial_metrics(points)
    assert engine == "cpp"
    monkeypatch.setattr(analytics, "native_library", lambda: None)
    py_mean, py_close, engine = analytics.spatial_metrics(points)
    assert engine == "python"
    assert cpp_mean == pytest.approx(py_mean, abs=1e-8)
    assert cpp_close == py_close


def test_neighbor_geometry_and_bounds(osm_payload):
    points = records(osm_payload)[:2]
    expected = haversine_m(points[0].lat, points[0].lng, points[1].lat, points[1].lng)
    mean, close, _ = analytics.spatial_metrics(points)
    assert mean == pytest.approx(expected, abs=1e-8)
    assert close == float(expected <= 50)
    points[1].lat, points[1].lng = points[0].lat, points[0].lng
    assert analytics.spatial_metrics(points)[:2] == (0, 1)
    assert analytics.spatial_metrics(points[:1]) == (None, None, "not_computed")
    assert analytics.spatial_metrics([points[0]] * 2001) == (None, None, "not_computed")


def test_native_rejects_invalid_input():
    native = analytics.native_library()
    if native is None:
        pytest.skip("Native library is not built")
    lat = (ctypes.c_double * 2)(float("nan"), 0)
    lng = (ctypes.c_double * 2)(0, 0)
    mean, close = ctypes.c_double(), ctypes.c_double()
    assert native.gb_spatial(lat, lng, 2, 50, ctypes.byref(mean), ctypes.byref(close)) == 2
    assert native.gb_spatial(lat, lng, 2001, 50, ctypes.byref(mean), ctypes.byref(close)) == 1


def test_category_tie_has_no_unique_dominant(osm_payload):
    points = records(osm_payload)[:2]
    points[0].category = Category.FOOD
    points[1].category = Category.HEALTH
    result = analytics.analyze(points, 250)
    assert result.dominant_category is None
    assert result.dominant_share == 0.5
