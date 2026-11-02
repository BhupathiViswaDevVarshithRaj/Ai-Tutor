import asyncio

import pytest

from app.core.config import get_settings
from app.services.health import default_checks

PREFIX = get_settings().api_prefix


async def _ok() -> None:
    return None


async def _fail() -> None:
    raise ConnectionError("connection refused")


async def _hang() -> None:
    await asyncio.sleep(60)


async def test_liveness(client):
    resp = await client.get(f"{PREFIX}/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


async def test_readiness_all_ok(app, client):
    app.dependency_overrides[default_checks] = lambda: {"database": _ok, "redis": _ok}
    resp = await client.get(f"{PREFIX}/health/ready")
    body = resp.json()
    assert resp.status_code == 200
    assert body["status"] == "ok"
    assert body["checks"]["database"]["status"] == "ok"


async def test_readiness_reports_failure_as_503(app, client):
    app.dependency_overrides[default_checks] = lambda: {"database": _fail, "redis": _ok}
    resp = await client.get(f"{PREFIX}/health/ready")
    body = resp.json()
    assert resp.status_code == 503
    assert body["status"] == "degraded"
    assert "connection refused" in body["checks"]["database"]["error"]
    assert body["checks"]["redis"]["status"] == "ok"


async def test_readiness_times_out_hanging_check(app, client, monkeypatch):
    monkeypatch.setattr(get_settings(), "health_check_timeout_seconds", 0.05)
    app.dependency_overrides[default_checks] = lambda: {"database": _hang}
    resp = await client.get(f"{PREFIX}/health/ready")
    assert resp.status_code == 503
    assert "timed out" in resp.json()["checks"]["database"]["error"]


async def test_cors_allows_frontend_origin(client):
    origin = get_settings().cors_origins[0]
    resp = await client.options(
        f"{PREFIX}/health",
        headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
    )
    assert resp.headers.get("access-control-allow-origin") == origin


@pytest.mark.integration
async def test_readiness_against_real_services(api):
    """Requires `docker compose up -d`; skipped otherwise."""
    resp = await api.get(f"{PREFIX}/health/ready")
    assert resp.status_code == 200, resp.json()
