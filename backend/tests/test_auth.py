from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text

from app.core.config import get_settings
from app.core.security import create_access_token
from app.db.session import get_engine
from tests.conftest import API, register_user

pytestmark = pytest.mark.integration

COOKIE = get_settings().refresh_cookie_name
CSRF = {"X-CSRF-Protection": "1"}


async def _sql(statement: str, **params) -> None:
    async with get_engine().begin() as conn:
        await conn.execute(text(statement), params)


# --- Registration ----------------------------------------------------------


async def test_register_returns_tokens_profile_and_default_preferences(api):
    resp = await api.post(
        f"{API}/auth/register",
        json={"email": "Asha@Example.com", "password": "learning123", "full_name": "  Asha  "},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["token_type"] == "bearer" and body["access_token"]
    assert body["expires_in"] == 15 * 60
    assert body["user"]["email"] == "asha@example.com"
    assert body["user"]["full_name"] == "Asha"
    assert body["user"]["preferences"]["preferred_language"] == "en"
    assert body["user"]["preferences"]["learning_level"] == "beginner"
    assert "password" not in resp.text

    set_cookie = resp.headers["set-cookie"]
    assert f"{COOKIE}=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "SameSite=strict" in set_cookie
    assert f"Path={API}/auth" in set_cookie


async def test_register_rejects_duplicate_email_case_insensitively(api):
    await register_user(api, email="dup@example.com")
    resp = await api.post(
        f"{API}/auth/register",
        json={"email": "DUP@example.com", "password": "learning123", "full_name": "Other"},
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "email_taken"


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "a@example.com", "password": "short1", "full_name": "A"},
        {"email": "a@example.com", "password": "onlyletters", "full_name": "A"},
        {"email": "not-an-email", "password": "learning123", "full_name": "A"},
        {"email": "a@example.com", "password": "learning123", "full_name": "   "},
    ],
)
async def test_register_validates_input(api, payload):
    resp = await api.post(f"{API}/auth/register", json=payload)
    assert resp.status_code == 422


async def test_password_is_stored_as_argon2_hash(api):
    await register_user(api, email="hash@example.com", password="learning123")
    async with get_engine().connect() as conn:
        stored = await conn.scalar(text("SELECT password_hash FROM users"))
    assert stored.startswith("$argon2id$")
    assert "learning123" not in stored


# --- Login / me ------------------------------------------------------------


async def test_login_success_and_me(api):
    await register_user(api, email="me@example.com", password="learning123")
    api.cookies.clear()
    resp = await api.post(
        f"{API}/auth/login", json={"email": "ME@example.com", "password": "learning123"}
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    me = await api.get(f"{API}/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "me@example.com"


async def test_login_failures_are_indistinguishable(api):
    await register_user(api, email="known@example.com", password="learning123")
    wrong_pw = await api.post(
        f"{API}/auth/login", json={"email": "known@example.com", "password": "wrong-password1"}
    )
    unknown = await api.post(
        f"{API}/auth/login", json={"email": "nobody@example.com", "password": "learning123"}
    )
    assert wrong_pw.status_code == unknown.status_code == 401
    assert wrong_pw.json() == unknown.json()


async def test_protected_route_requires_valid_token(api):
    assert (await api.get(f"{API}/users/me")).status_code == 401
    bad = await api.get(f"{API}/users/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert bad.status_code == 401
    assert bad.json()["code"] == "invalid_token"


async def test_expired_access_token_is_rejected(api, monkeypatch):
    await register_user(api)
    monkeypatch.setattr(get_settings(), "access_token_ttl_minutes", -1)
    async with get_engine().connect() as conn:
        user_id = await conn.scalar(text("SELECT id FROM users"))
    expired, _ = create_access_token(user_id)
    resp = await api.get(f"{API}/users/me", headers={"Authorization": f"Bearer {expired}"})
    assert resp.status_code == 401


async def test_login_is_rate_limited(api, monkeypatch):
    monkeypatch.setattr(get_settings(), "auth_rate_limit", 3)
    payload = {"email": "rl@example.com", "password": "wrong-password1"}
    codes = [(await api.post(f"{API}/auth/login", json=payload)).status_code for _ in range(4)]
    assert codes == [401, 401, 401, 429]


# --- Refresh / logout -------------------------------------------------------


async def test_refresh_requires_csrf_header(api):
    await register_user(api)
    resp = await api.post(f"{API}/auth/refresh")
    assert resp.status_code == 403
    assert resp.json()["code"] == "csrf_header_missing"


async def test_refresh_without_cookie_is_401(api):
    resp = await api.post(f"{API}/auth/refresh", headers=CSRF)
    assert resp.status_code == 401


async def test_refresh_rotates_the_token(api):
    await register_user(api)
    first = api.cookies.get(COOKIE)
    resp = await api.post(f"{API}/auth/refresh", headers=CSRF)
    assert resp.status_code == 200
    assert resp.json()["user"]["email"] == "learner@example.com"
    second = api.cookies.get(COOKIE)
    assert second and second != first


async def test_concurrent_refresh_race_does_not_end_the_session(api):
    await register_user(api)
    old = api.cookies.get(COOKIE)
    assert (await api.post(f"{API}/auth/refresh", headers=CSRF)).status_code == 200
    new = api.cookies.get(COOKIE)

    api.cookies.set(COOKIE, old, path=f"{API}/auth")
    race = await api.post(f"{API}/auth/refresh", headers=CSRF)
    assert race.status_code == 401 and race.json()["code"] == "refresh_race"

    api.cookies.set(COOKIE, new, path=f"{API}/auth")
    assert (await api.post(f"{API}/auth/refresh", headers=CSRF)).status_code == 200


async def test_reuse_of_old_refresh_token_revokes_all_sessions(api):
    await register_user(api)
    old = api.cookies.get(COOKIE)
    assert (await api.post(f"{API}/auth/refresh", headers=CSRF)).status_code == 200
    new = api.cookies.get(COOKIE)
    # Move the rotation outside the grace window, so this looks like a stolen token.
    await _sql(
        "UPDATE refresh_tokens SET revoked_at = now() - interval '1 hour' "
        "WHERE revoked_at IS NOT NULL"
    )

    api.cookies.set(COOKIE, old, path=f"{API}/auth")
    reuse = await api.post(f"{API}/auth/refresh", headers=CSRF)
    assert reuse.status_code == 401 and reuse.json()["code"] == "invalid_refresh_token"

    api.cookies.set(COOKIE, new, path=f"{API}/auth")
    assert (await api.post(f"{API}/auth/refresh", headers=CSRF)).status_code == 401


async def test_expired_refresh_token_is_rejected(api):
    await register_user(api)
    await _sql("UPDATE refresh_tokens SET expires_at = now() - interval '1 second'")
    assert (await api.post(f"{API}/auth/refresh", headers=CSRF)).status_code == 401


async def test_logout_revokes_refresh_token_and_clears_cookie(api):
    await register_user(api)
    token = api.cookies.get(COOKIE)
    resp = await api.post(f"{API}/auth/logout", headers=CSRF)
    assert resp.status_code == 204
    assert f'{COOKIE}=""' in resp.headers["set-cookie"] or "Max-Age=0" in resp.headers["set-cookie"]

    api.cookies.set(COOKIE, token, path=f"{API}/auth")
    assert (await api.post(f"{API}/auth/refresh", headers=CSRF)).status_code == 401


# --- Password reset / change ------------------------------------------------


def _token_from(outbox) -> str:
    body = outbox.sent[-1]["body"]
    return body.split("reset-password?token=")[1].split()[0]


async def test_password_reset_flow(api, outbox):
    await register_user(api, email="reset@example.com", password="learning123")
    old_refresh = api.cookies.get(COOKIE)

    resp = await api.post(f"{API}/auth/password-reset/request", json={"email": "reset@example.com"})
    assert resp.status_code == 202
    assert outbox.sent[-1]["to"] == "reset@example.com"
    assert "http://localhost:5173/reset-password?token=" in outbox.sent[-1]["body"]
    token = _token_from(outbox)

    confirm = await api.post(
        f"{API}/auth/password-reset/confirm", json={"token": token, "new_password": "newpass456"}
    )
    assert confirm.status_code == 204

    # Old password fails, new one works, old sessions are revoked, link is single-use.
    old_login = {"email": "reset@example.com", "password": "learning123"}
    assert (await api.post(f"{API}/auth/login", json=old_login)).status_code == 401
    new_login = {"email": "reset@example.com", "password": "newpass456"}
    assert (await api.post(f"{API}/auth/login", json=new_login)).status_code == 200
    api.cookies.set(COOKIE, old_refresh, path=f"{API}/auth")
    assert (await api.post(f"{API}/auth/refresh", headers=CSRF)).status_code == 401
    again = await api.post(
        f"{API}/auth/password-reset/confirm", json={"token": token, "new_password": "other789x"}
    )
    assert again.status_code == 400


async def test_password_reset_for_unknown_email_looks_the_same(api, outbox):
    resp = await api.post(f"{API}/auth/password-reset/request", json={"email": "ghost@example.com"})
    assert resp.status_code == 202
    assert outbox.sent == []


async def test_only_newest_reset_link_is_valid_and_links_expire(api, outbox):
    await register_user(api, email="multi@example.com")
    payload = {"email": "multi@example.com"}
    await api.post(f"{API}/auth/password-reset/request", json=payload)
    first = _token_from(outbox)
    await api.post(f"{API}/auth/password-reset/request", json=payload)
    second = _token_from(outbox)

    stale = await api.post(
        f"{API}/auth/password-reset/confirm", json={"token": first, "new_password": "newpass456"}
    )
    assert stale.status_code == 400

    await _sql(
        "UPDATE password_reset_tokens SET expires_at = :t",
        t=datetime.now(UTC) - timedelta(seconds=1),
    )
    expired = await api.post(
        f"{API}/auth/password-reset/confirm", json={"token": second, "new_password": "newpass456"}
    )
    assert expired.status_code == 400
    assert expired.json()["code"] == "invalid_reset_token"


async def test_change_password(api):
    headers = await register_user(api, password="learning123")
    wrong = await api.post(
        f"{API}/auth/change-password",
        headers={**headers, **CSRF},
        json={"current_password": "nope12345", "new_password": "newpass456"},
    )
    assert wrong.status_code == 400

    ok = await api.post(
        f"{API}/auth/change-password",
        headers={**headers, **CSRF},
        json={"current_password": "learning123", "new_password": "newpass456"},
    )
    assert ok.status_code == 200
    assert (await api.post(f"{API}/auth/refresh", headers=CSRF)).status_code == 200
    login = {"email": "learner@example.com", "password": "newpass456"}
    assert (await api.post(f"{API}/auth/login", json=login)).status_code == 200
