import pytest

from tests.conftest import API, register_user

pytestmark = pytest.mark.integration


async def test_update_profile(api):
    headers = await register_user(api)
    resp = await api.patch(f"{API}/users/me", headers=headers, json={"full_name": "  New Name "})
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "New Name"
    assert (
        await api.patch(f"{API}/users/me", headers=headers, json={"full_name": ""})
    ).status_code == 422


async def test_preferences_partial_update(api):
    headers = await register_user(api)
    resp = await api.patch(
        f"{API}/users/me/preferences",
        headers=headers,
        json={
            "preferred_language": "te",
            "learning_level": "advanced",
            "interests": [" Physics ", "physics", "Machine Learning"],
            "tts_speed": 1.25,
        },
    )
    assert resp.status_code == 200, resp.text
    prefs = resp.json()
    assert prefs["preferred_language"] == "te"
    assert prefs["learning_level"] == "advanced"
    assert prefs["interests"] == ["Physics", "Machine Learning"]
    assert prefs["tts_speed"] == 1.25
    assert prefs["theme"] == "system"  # untouched

    again = await api.get(f"{API}/users/me/preferences", headers=headers)
    assert again.json() == prefs


@pytest.mark.parametrize(
    "payload",
    [
        {"preferred_language": "fr"},
        {"learning_level": "expert"},
        {"tts_speed": 3},
        {"daily_goal_minutes": 1},
        {"interests": ["x" * 51]},
        {"interests": [f"topic {i}" for i in range(21)]},
        {"theme": "neon"},
    ],
)
async def test_preferences_validation(api, payload):
    headers = await register_user(api)
    resp = await api.patch(f"{API}/users/me/preferences", headers=headers, json=payload)
    assert resp.status_code == 422
