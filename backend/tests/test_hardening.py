"""HTTP hardening: security headers, body-size limit, per-user limits, production docs."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.main import create_app
from tests.conftest import API, register_user

pytestmark = pytest.mark.integration

TOPIC = {"topic": "Photosynthesis", "level": "beginner", "language": "en"}


async def test_api_responses_carry_security_headers(api):
    resp = await api.get(f"{API}/health")
    h = resp.headers
    assert h["x-content-type-options"] == "nosniff"
    assert h["x-frame-options"] == "DENY"
    assert h["referrer-policy"] == "no-referrer"
    assert h["cross-origin-resource-policy"] == "same-origin"
    assert "default-src 'none'" in h["content-security-policy"]
    assert "frame-ancestors 'none'" in h["content-security-policy"]
    assert h["cache-control"] == "no-store"
    # HSTS only in production (it would pin plain-HTTP dev hosts to HTTPS).
    assert "strict-transport-security" not in h


async def test_streamed_replies_and_docs_keep_working(api):
    headers = await register_user(api)
    lesson = (await api.post(f"{API}/tutor/lessons", headers=headers, json=TOPIC)).json()
    resp = await api.post(
        f"{API}/tutor/conversations/{lesson['conversation']['id']}/reply",
        headers=headers,
        json={"content": "Tell me more"},
    )
    assert resp.status_code == 200 and "data:" in resp.text
    assert resp.headers["x-content-type-options"] == "nosniff"
    docs = await api.get("/docs")
    assert docs.status_code == 200 and "content-security-policy" not in docs.headers


async def test_oversized_bodies_are_rejected(api, monkeypatch):
    headers = await register_user(api)
    big = {"content": "x" * (get_settings().max_request_bytes + 10)}
    resp = await api.post(f"{API}/conversations", headers=headers, json=big)
    assert resp.status_code == 413
    assert resp.json()["code"] == "request_too_large"

    # Without Content-Length (chunked), the body is counted as it arrives.
    async def chunks():
        for _ in range(5):
            yield b"x" * (get_settings().max_request_bytes // 4)

    resp = await api.post(
        f"{API}/conversations",
        headers={**headers, "Content-Type": "application/json"},
        content=chunks(),
    )
    assert resp.status_code == 413


async def test_audio_uploads_use_their_own_larger_limit(api, monkeypatch):
    monkeypatch.setattr(get_settings(), "max_request_bytes", 1000)
    headers = await register_user(api)
    resp = await api.post(
        f"{API}/speech/transcribe",
        params={"language": "en"},
        content=b"RIFF" + bytes(4000),
        headers={**headers, "Content-Type": "audio/wav"},
    )
    assert resp.status_code != 413  # judged by the speech route, not the JSON limit


async def test_ai_limits_are_per_user_not_per_address(api, monkeypatch):
    monkeypatch.setattr(get_settings(), "ai_rate_limit", 2)
    alice = await register_user(api, email="alice@example.com")
    bob = await register_user(api, email="bob@example.com")  # same IP as Alice in tests
    for _ in range(2):
        resp = await api.post(f"{API}/tutor/lessons", headers=alice, json=TOPIC)
        assert resp.status_code == 201
    resp = await api.post(f"{API}/tutor/lessons", headers=alice, json=TOPIC)
    assert resp.status_code == 429
    resp = await api.post(f"{API}/tutor/lessons", headers=bob, json=TOPIC)
    assert resp.status_code == 201


async def test_production_hides_docs_and_sends_hsts(monkeypatch):
    monkeypatch.setattr(get_settings(), "app_env", "production")
    prod = create_app()
    async with AsyncClient(transport=ASGITransport(app=prod), base_url="https://test") as c:
        for path in ("/docs", "/redoc", "/openapi.json"):
            assert (await c.get(path)).status_code == 404
        resp = await c.get(f"{API}/health")
        assert resp.headers["strict-transport-security"].startswith("max-age=")
