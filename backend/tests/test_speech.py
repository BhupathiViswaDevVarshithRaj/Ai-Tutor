from array import array

import pytest

from app.ai.speech.audio import encode_wav, wav_duration_ms
from app.ai.speech.factory import get_stt, get_tts
from app.ai.speech.gnani import GnaniSTTProvider, GnaniTTSProvider
from app.ai.speech.mock import MOCK_TRANSCRIPT
from app.core.config import get_settings
from tests.conftest import API, register_user

pytestmark = pytest.mark.integration

WAV = encode_wav(array("h", bytes(2 * 16 * 500)))  # 500 ms of silence
WEBM = b"\x1a\x45\xdf\xa3" + bytes(200)
TUTOR = ["en", "hi", "te", "ta", "pa", "bn"]
COURSES = ["de", "fr", "es", "ja", "ko", "zh", "it", "pt"]


@pytest.fixture
def gnani(app):
    settings = get_settings()
    app.dependency_overrides[get_stt] = lambda: GnaniSTTProvider(settings)
    app.dependency_overrides[get_tts] = lambda: GnaniTTSProvider(settings)


async def transcribe(api, headers, body: bytes, content_type: str, language: str = "hi"):
    return await api.post(
        f"{API}/speech/transcribe",
        params={"language": language},
        content=body,
        headers={**headers, "Content-Type": content_type},
    )


async def test_speech_requires_auth(api):
    assert (await api.get(f"{API}/speech/info")).status_code == 401
    resp = await api.post(f"{API}/speech/synthesize", json={"text": "hi", "language": "en"})
    assert resp.status_code == 401


async def test_info_reports_mock_providers_and_language_matrix(api):
    headers = await register_user(api)
    body = (await api.get(f"{API}/speech/info", headers=headers)).json()
    assert body["stt"] == {
        "provider": "mock",
        "is_mock": True,
        "available": True,
        "unavailable_reason": None,
        "languages": sorted(TUTOR + COURSES),
    }
    assert [v["id"] for v in body["tts"]["voices"]] == ["mock-bright", "mock-calm"]
    # Tutor languages first, then the world-language courses (practice only).
    assert [lang["code"] for lang in body["languages"]] == TUTOR + COURSES
    assert [lang["code"] for lang in body["languages"] if lang["tutor"]] == TUTOR
    assert next(lang for lang in body["languages"] if lang["code"] == "zh")["name"] == "Chinese"
    assert all(lang["stt"] and lang["tts"] for lang in body["languages"])
    assert body["limits"]["max_tts_chars"] == 2000
    assert "audio/webm" in body["limits"]["audio_types"]
    # Credentials and base URLs never reach the client.
    assert "gnani_api" not in str(body).lower()


async def test_transcribe_wav_and_webm(api):
    headers = await register_user(api)
    resp = await transcribe(api, headers, WAV, "audio/wav")
    assert resp.status_code == 200, resp.text
    assert resp.json() == {
        "text": MOCK_TRANSCRIPT,
        "language": "hi",
        "confidence": None,
        "duration_ms": 500,
        "provider": "mock",
        "is_mock": True,
    }
    resp = await transcribe(api, headers, WEBM, "audio/webm;codecs=opus", language="ta")
    assert resp.status_code == 200, resp.text
    assert resp.json()["language"] == "ta"
    assert resp.json()["duration_ms"] is None


@pytest.mark.parametrize(
    ("body", "content_type", "status", "code"),
    [
        (WAV, "text/plain", 415, "unsupported_audio"),
        (WAV, "audio/webm", 415, "unsupported_audio"),  # bytes don't match the declared type
        (b"<html>" + bytes(100), "audio/wav", 415, "unsupported_audio"),
        (WAV[:40], "audio/wav", 422, "audio_too_short"),
        (b"", "audio/wav", 422, "audio_too_short"),
    ],
)
async def test_transcribe_rejects_bad_uploads(api, body, content_type, status, code):
    headers = await register_user(api)
    resp = await transcribe(api, headers, body, content_type)
    assert resp.status_code == status, resp.text
    assert resp.json()["code"] == code


async def test_transcribe_rejects_oversized_audio(api, monkeypatch):
    monkeypatch.setattr(get_settings(), "speech_max_audio_bytes", 1000)
    headers = await register_user(api)
    resp = await transcribe(api, headers, WAV, "audio/wav")
    assert resp.status_code == 413
    assert resp.json()["code"] == "audio_too_large"


async def test_transcribe_rejects_unknown_language(api):
    headers = await register_user(api)
    resp = await transcribe(api, headers, WAV, "audio/wav", language="sw")
    assert resp.status_code == 422


async def test_synthesize_returns_wav_with_metadata(api):
    headers = await register_user(api)
    resp = await api.post(
        f"{API}/speech/synthesize",
        headers=headers,
        json={
            "text": "  Plants make food.  ",
            "language": "bn",
            "voice": "mock-calm",
            "speed": 1.5,
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"] == "audio/wav"
    assert resp.headers["x-speech-voice"] == "mock-calm"
    assert resp.headers["x-speech-provider"] == "mock"
    assert resp.headers["x-speech-mock"] == "true"
    assert resp.headers["cache-control"] == "no-store"
    assert wav_duration_ms(resp.content) == int(resp.headers["x-speech-duration-ms"])


@pytest.mark.parametrize(
    "payload",
    [
        {"text": "", "language": "en"},
        {"text": "   ", "language": "en"},
        {"text": "hi", "language": "sw"},
        {"text": "hi", "language": "en", "speed": 3},
        {"text": "hi", "language": "en", "voice": "v" * 101},
    ],
)
async def test_synthesize_validates_input(api, payload):
    headers = await register_user(api)
    resp = await api.post(f"{API}/speech/synthesize", headers=headers, json=payload)
    assert resp.status_code == 422


async def test_synthesize_enforces_configured_length(api, monkeypatch):
    monkeypatch.setattr(get_settings(), "speech_max_tts_chars", 10)
    headers = await register_user(api)
    resp = await api.post(
        f"{API}/speech/synthesize", headers=headers, json={"text": "x" * 11, "language": "en"}
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "text_too_long"


async def test_gnani_selected_returns_clear_unavailable_errors(api, gnani):
    headers = await register_user(api)
    info = (await api.get(f"{API}/speech/info", headers=headers)).json()
    assert info["stt"]["provider"] == "gnani" and info["stt"]["available"] is False
    assert "disabled" in info["stt"]["unavailable_reason"]
    assert not any(lang["stt"] or lang["tts"] for lang in info["languages"])

    resp = await transcribe(api, headers, WAV, "audio/wav")
    assert resp.status_code == 503
    assert resp.json()["code"] == "speech_not_configured"
    resp = await api.post(
        f"{API}/speech/synthesize", headers=headers, json={"text": "hi", "language": "en"}
    )
    assert resp.status_code == 503
    assert resp.json()["code"] == "speech_not_configured"


async def test_speech_is_rate_limited(api, monkeypatch):
    monkeypatch.setattr(get_settings(), "speech_rate_limit", 2)
    headers = await register_user(api)
    payload = {"text": "hi", "language": "en"}
    for _ in range(2):
        resp = await api.post(f"{API}/speech/synthesize", headers=headers, json=payload)
        assert resp.status_code == 200
    resp = await api.post(f"{API}/speech/synthesize", headers=headers, json=payload)
    assert resp.status_code == 429
