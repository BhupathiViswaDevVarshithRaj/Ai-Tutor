"""Unit tests for the speech layer: audio helpers, mock and Gnani providers, selection."""

import json
from array import array

import httpx
import pytest

from app.ai.speech.audio import (
    base_mime,
    decode_to_wav,
    encode_wav,
    sniff_container,
    split_wav,
    wav_duration_ms,
)
from app.ai.speech.base import ProviderNotConfigured, SpeechError, UnsupportedLanguage
from app.ai.speech.factory import get_stt, get_tts
from app.ai.speech.gnani import DEFAULT_BASE_URL, GnaniSTTProvider, GnaniTTSProvider
from app.ai.speech.mock import MOCK_TRANSCRIPT, MockSTTProvider, MockTTSProvider
from app.core.config import Settings, get_settings
from app.services.speech_service import speech_info


def silent_wav(ms: int) -> bytes:
    return encode_wav(array("h", bytes(2 * 16 * ms)))


# --- audio helpers -----------------------------------------------------------


@pytest.mark.parametrize(
    ("data", "container"),
    [
        (silent_wav(10), "wav"),
        (b"\x1a\x45\xdf\xa3" + bytes(60), "webm"),
        (b"OggS" + bytes(60), "ogg"),
        (b"ID3" + bytes(60), "mp3"),
        (b"\xff\xfb" + bytes(60), "mp3"),
        (b"\x00\x00\x00\x20ftypM4A " + bytes(60), "mp4"),
        (b"<html>" + bytes(60), None),
        (b"", None),
    ],
)
def test_sniff_container(data, container):
    assert sniff_container(data) == container


def test_base_mime_strips_parameters():
    assert base_mime("audio/webm;codecs=opus") == "audio/webm"
    assert base_mime(" Audio/WAV ") == "audio/wav"
    assert base_mime(None) == ""


def test_wav_duration():
    assert wav_duration_ms(silent_wav(250)) == 250
    assert wav_duration_ms(b"not a wav") is None


# --- mock providers ----------------------------------------------------------


async def test_mock_stt_returns_labelled_placeholder_with_duration():
    result = await MockSTTProvider().transcribe(
        silent_wav(300), mime_type="audio/wav", language="te"
    )
    assert result.text == MOCK_TRANSCRIPT and result.text.startswith("[Mock transcript]")
    assert result.language == "te"
    assert result.duration_ms == 300


async def test_mock_stt_rejects_unknown_language():
    with pytest.raises(UnsupportedLanguage):
        await MockSTTProvider().transcribe(silent_wav(10), mime_type="audio/wav", language="sw")


async def test_mock_tts_produces_valid_wav_of_realistic_length():
    tts = MockTTSProvider()
    text = "Plants make food from sunlight."  # 31 characters
    result = await tts.synthesize(text, language="hi")
    assert result.mime_type == "audio/wav"
    assert result.voice == "mock-bright"
    assert sniff_container(result.audio) == "wav"
    assert wav_duration_ms(result.audio) == result.duration_ms == round(31 * 1000 / 14)

    faster = await tts.synthesize(text, language="hi", voice="mock-calm", speed=2.0)
    assert faster.voice == "mock-calm"
    assert faster.duration_ms == pytest.approx(result.duration_ms / 2, abs=1)


async def test_mock_tts_falls_back_to_default_voice_and_minimum_length():
    result = await MockTTSProvider().synthesize("Hi", language="en", voice="unknown")
    assert result.voice == "mock-bright"
    assert result.duration_ms == 400


async def test_mock_tts_is_not_silent():
    result = await MockTTSProvider().synthesize("one two three", language="en")
    samples = array("h", result.audio[44:])
    assert max(abs(s) for s in samples) > 1000


# --- Gnani (stand-in HTTP transport: no real calls) ---------------------------


def gnani_settings(**overrides) -> Settings:
    base = {"gnani_api_key": "", "gnani_api_base_url": ""}
    return Settings(**{**base, **overrides})


ENABLED = {"gnani_stt_enabled": True, "gnani_tts_enabled": True, "gnani_api_key": "test-key"}


def streamed_wav(ms: int, rate: int = 48_000) -> bytes:
    """A WAV like Gnani's: the RIFF and data sizes are 0xFFFFFFFF (written while streaming)."""
    data = bytearray(encode_wav(array("h", bytes(2 * rate * ms // 1000))))
    data[24:28] = rate.to_bytes(4, "little")
    data[28:32] = (rate * 2).to_bytes(4, "little")  # byte rate
    data[4:8] = data[40:44] = b"\xff\xff\xff\xff"
    return bytes(data)


class FakeGnani:
    """Records requests and replies the way the documented API does."""

    def __init__(self, *, status: int = 200, transcript: str = "namaste") -> None:
        self.requests: list[httpx.Request] = []
        self.status, self.transcript = status, transcript

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.status != 200:
            return httpx.Response(self.status, json={"success": False, "message": "nope"})
        if request.url.path == "/stt/v3":
            return httpx.Response(200, json={"success": True, "transcript": self.transcript})
        wav = streamed_wav(1500)
        return httpx.Response(200, content=wav, headers={"content-type": "audio/wav"})

    def providers(self) -> tuple[GnaniSTTProvider, GnaniTTSProvider]:
        settings, transport = gnani_settings(**ENABLED), httpx.MockTransport(self)
        return GnaniSTTProvider(settings, transport), GnaniTTSProvider(settings, transport)


def test_gnani_reports_why_it_is_unavailable():
    assert "disabled" in GnaniSTTProvider(gnani_settings()).unavailable_reason
    missing = gnani_settings(gnani_stt_enabled=True, gnani_tts_enabled=True)
    assert "GNANI_API_KEY" in GnaniSTTProvider(missing).unavailable_reason
    assert "GNANI_API_KEY" in GnaniTTSProvider(missing).unavailable_reason
    assert GnaniSTTProvider(gnani_settings(**ENABLED)).unavailable_reason is None


async def test_gnani_disabled_calls_raise_not_configured():
    settings = gnani_settings(gnani_api_key="k")
    with pytest.raises(ProviderNotConfigured):
        await GnaniSTTProvider(settings).transcribe(b"x", mime_type="audio/wav", language="hi")
    with pytest.raises(ProviderNotConfigured):
        await GnaniTTSProvider(settings).synthesize("hello", language="hi")


async def test_gnani_stt_sends_documented_request():
    fake = FakeGnani()
    stt, _ = fake.providers()
    result = await stt.transcribe(silent_wav(1200), mime_type="audio/wav", language="hi")
    assert result.text == "namaste" and result.language == "hi" and result.duration_ms == 1200
    (request,) = fake.requests
    assert str(request.url) == f"{DEFAULT_BASE_URL}/stt/v3"
    assert request.headers["X-API-Key-ID"] == "test-key"
    body = request.read()
    assert b'name="language_code"' in body and b"hi-IN" in body
    assert b'name="audio_file"; filename="speech.wav"' in body


async def test_gnani_stt_splits_recordings_over_the_30_second_limit():
    fake = FakeGnani(transcript="part")
    stt, _ = fake.providers()
    result = await stt.transcribe(silent_wav(61_000), mime_type="audio/wav", language="en")
    assert len(fake.requests) == 3  # 28 s + 28 s + 5 s
    assert result.text == "part part part" and result.duration_ms == 61_000


async def test_gnani_stt_rejects_undecodable_audio_and_other_languages():
    stt, _ = FakeGnani().providers()
    junk_webm = b"\x1a\x45\xdf\xa3" + bytes(300)
    with pytest.raises(SpeechError, match="couldn't read"):
        await stt.transcribe(junk_webm, mime_type="audio/webm", language="en")
    with pytest.raises(UnsupportedLanguage):
        await stt.transcribe(silent_wav(500), mime_type="audio/wav", language="de")


async def test_gnani_tts_sends_documented_request_and_fixes_wav_header():
    fake = FakeGnani()
    _, tts = fake.providers()
    result = await tts.synthesize("Hello there", language="en", speed=1.25)
    (request,) = fake.requests
    assert str(request.url) == f"{DEFAULT_BASE_URL}/api/v1/tts/inference"
    assert json.loads(request.read()) == {
        "text": "Hello there",
        "voice": "Kaveri",
        "model": "timbre-v2.5",
        "language": "en-IN",
        "speed": 1.25,
        "audio_config": {
            "sample_rate": 48000,
            "num_channels": 1,
            "sample_width": 2,
            "encoding": "linear_pcm",
            "container": "wav",
        },
    }
    assert result.duration_ms == 1500 and result.mime_type == "audio/wav"
    # The streamed 0xFFFFFFFF sizes are replaced with the real ones.
    assert result.audio[4:8] != b"\xff\xff\xff\xff" and wav_duration_ms(result.audio) == 1500


async def test_gnani_tts_voice_must_match_the_language():
    _, tts = FakeGnani().providers()
    assert (await tts.synthesize("x", language="hi", voice="Deepak")).voice == "Deepak"
    # An English voice for Hindi text falls back to the Hindi default.
    assert (await tts.synthesize("x", language="hi", voice="Kaveri")).voice == "Nalini"
    assert {v.languages for v in tts.voices()} == {(lang,) for lang in tts.supported_languages()}
    with pytest.raises(UnsupportedLanguage):
        await tts.synthesize("Hallo", language="de")


class FlakyGnani(FakeGnani):
    """Fails to connect a set number of times first, like a network filter's bad certificate."""

    def __init__(self, failures: int) -> None:
        super().__init__()
        self.failures = failures

    def __call__(self, request: httpx.Request) -> httpx.Response:
        if self.failures:
            self.failures -= 1
            raise httpx.ConnectError("certificate verify failed")
        return super().__call__(request)


async def test_gnani_tries_again_when_a_connection_fails(monkeypatch):
    waits = []

    async def no_wait(seconds):
        waits.append(seconds)

    monkeypatch.setattr("app.ai.speech.gnani.asyncio.sleep", no_wait)
    _, tts = FlakyGnani(failures=2).providers()
    assert (await tts.synthesize("hello", language="en")).duration_ms == 1500
    assert waits == [1, 2]
    _, tts = FlakyGnani(failures=3).providers()
    with pytest.raises(SpeechError, match="Couldn't reach"):
        await tts.synthesize("hello", language="en")


@pytest.mark.parametrize(
    ("status", "message", "retryable"),
    [
        (401, "isn't configured correctly", False),
        (429, "busy", True),
        (500, "ran into a problem", True),
        (400, "couldn't process", False),
    ],
)
async def test_gnani_http_errors_become_safe_speech_errors(status, message, retryable):
    _, tts = FakeGnani(status=status).providers()
    with pytest.raises(SpeechError, match=message) as info:
        await tts.synthesize("hello", language="en")
    assert info.value.retryable is retryable


def test_gnani_info_lists_the_indian_tutor_languages():
    stt, tts = FakeGnani().providers()
    info = speech_info(stt, tts, gnani_settings(**ENABLED))
    assert info.stt.available and info.tts.available
    supported = {lang.code for lang in info.languages if lang.stt and lang.tts}
    assert supported == {"en", "hi", "te", "ta", "pa", "bn"}
    # Credentials never reach the client.
    assert "test-key" not in info.model_dump_json()


def test_decode_to_wav_converts_and_split_wav_keeps_format():
    wav = decode_to_wav(streamed_wav(2000))
    assert wav_duration_ms(wav) == 2000
    assert [wav_duration_ms(p) for p in split_wav(wav, 900)] == [900, 900, 200]


# --- provider selection ------------------------------------------------------


@pytest.fixture
def fresh_factory():
    get_stt.cache_clear()
    get_tts.cache_clear()
    yield
    get_stt.cache_clear()
    get_tts.cache_clear()


def test_factory_defaults_to_mock(fresh_factory):
    assert isinstance(get_stt(), MockSTTProvider)
    assert isinstance(get_tts(), MockTTSProvider)


def test_factory_selects_gnani(fresh_factory, monkeypatch):
    monkeypatch.setattr(get_settings(), "stt_provider", "gnani")
    monkeypatch.setattr(get_settings(), "tts_provider", "gnani")
    assert isinstance(get_stt(), GnaniSTTProvider)
    assert isinstance(get_tts(), GnaniTTSProvider)
    assert get_stt().unavailable_reason is not None


# --- sentence splitting for spoken replies ----------------------------------------


def test_sentence_buffer_releases_complete_sentences_while_streaming():
    from app.ai.speech.sentences import SentenceBuffer

    buffer = SentenceBuffer(min_chars=10)
    assert buffer.feed("Plants make food from light") == []
    assert buffer.feed(".") == []  # waits for the space after the stop (could be "3.5")
    assert buffer.feed(" They need water too. And air") == [
        "Plants make food from light.",
        "They need water too.",
    ]
    assert buffer.flush() == ["And air"]


def test_sentence_buffer_merges_short_sentences_and_strips_markdown():
    from app.ai.speech.sentences import SentenceBuffer

    buffer = SentenceBuffer(min_chars=15)
    pieces = buffer.feed("Yes. **Exactly** right! Now `x` grows.\n- next point ")
    assert pieces == ["Yes. Exactly right!"]
    # "Now x grows." is under the minimum, so it waits and merges with the list item.
    assert buffer.flush() == ["Now x grows. next point"]


def test_sentence_buffer_handles_the_danda_and_long_runs():
    from app.ai.speech.sentences import SentenceBuffer

    buffer = SentenceBuffer(min_chars=5, max_chars=20)
    assert buffer.feed("पौधे भोजन बनाते हैं। फिर") == ["पौधे भोजन बनाते हैं।"]
    long_run = " word" * 10
    pieces = buffer.feed(long_run) + buffer.flush()
    assert all(len(p) <= 20 for p in pieces)
    assert " ".join(pieces).split() == ["फिर"] + ["word"] * 10
