import httpx
import pytest

from app.services.overpass import OverpassClient, ProviderError, build_query


def test_query_is_bounded_and_supports_all_osm_geometry_types():
    query = build_query(-12.1, -77.03, 500)
    assert "around:500,-12.1,-77.03" in query
    assert 'nwr["shop"]' in query and "out center" in query
    assert "timeout:25" in query


async def test_provider_success(osm_payload):
    async def transport(request):
        assert request.method == "POST"
        return httpx.Response(200, json=osm_payload)

    async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
        provider = OverpassClient(client, "https://osm.test/query", 0)
        assert (await provider.fetch(-12, -77, 250))["elements"] == osm_payload["elements"]


@pytest.mark.parametrize("status", [429, 504, 500])
async def test_upstream_failures_never_become_empty_results(status):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda r: httpx.Response(status))
    ) as client:
        provider = OverpassClient(client, "https://osm.test/query", 0)
        with pytest.raises(ProviderError) as exc:
            await provider.fetch(-12, -77, 250)
        assert exc.value.status_code == 503
        if status in {429, 504}:
            with pytest.raises(ProviderError) as blocked:
                await provider.fetch(-12, -77, 250)
            assert blocked.value.status_code == 429


@pytest.mark.parametrize(
    "payload",
    [
        {"elements": [], "remark": "runtime error: timeout"},
        {"elements": None},
        [1, 2],
    ],
)
async def test_partial_or_invalid_payload_is_rejected(payload):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda r: httpx.Response(200, json=payload))
    ) as client:
        provider = OverpassClient(client, "https://osm.test/query", 0)
        with pytest.raises(ProviderError):
            await provider.fetch(-12, -77, 250)


async def test_response_size_is_bounded():
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda r: httpx.Response(200, content=b"x" * 200))
    ) as client:
        provider = OverpassClient(client, "https://osm.test/query", 0)
        provider.MAX_BYTES = 100
        with pytest.raises(ProviderError, match="límite"):
            await provider.fetch(-12, -77, 250)
