"""Unit tests for the speech layer: audio helpers, mock providers, Gnani stubs, selection."""

import inspect
import re
from array import array

import pytest

from app.ai.speech import gnani
from app.ai.speech.audio import base_mime, encode_wav, sniff_container, wav_duration_ms
from app.ai.speech.base import ProviderNotConfigured, UnsupportedLanguage
from app.ai.speech.factory import get_stt, get_tts
from app.ai.speech.gnani import NOT_IMPLEMENTED, GnaniSTTProvider, GnaniTTSProvider
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
        await MockSTTProvider().transcribe(silent_wav(10), mime_type="audio/wav", language="fr")


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


# --- Gnani placeholders ------------------------------------------------------


def gnani_settings(**overrides) -> Settings:
    base = {"gnani_api_key": "", "gnani_api_base_url": ""}
    return Settings(**{**base, **overrides})


def test_gnani_reports_why_it_is_unavailable():
    assert "disabled" in GnaniSTTProvider(gnani_settings()).unavailable_reason
    missing = gnani_settings(gnani_stt_enabled=True, gnani_tts_enabled=True)
    assert "GNANI_API_KEY" in GnaniSTTProvider(missing).unavailable_reason
    assert "GNANI_API_KEY" in GnaniTTSProvider(missing).unavailable_reason
    configured = gnani_settings(
        gnani_stt_enabled=True, gnani_api_key="k", gnani_api_base_url="https://example.invalid"
    )
    # Even fully configured, the adapter is not implemented until official docs exist.
    assert GnaniSTTProvider(configured).unavailable_reason == NOT_IMPLEMENTED


async def test_gnani_calls_raise_not_configured():
    settings = gnani_settings(gnani_stt_enabled=True, gnani_tts_enabled=True)
    with pytest.raises(ProviderNotConfigured):
        await GnaniSTTProvider(settings).transcribe(b"x", mime_type="audio/wav", language="hi")
    with pytest.raises(ProviderNotConfigured):
        await GnaniTTSProvider(settings).synthesize("hello", language="hi")
    assert GnaniTTSProvider(settings).voices() == ()
    assert GnaniSTTProvider(settings).supported_languages() == ()


def test_gnani_module_makes_no_network_calls():
    source = inspect.getsource(gnani)
    assert not re.search(
        r"^\s*(import|from)\s+(httpx|requests|aiohttp|urllib|socket)", source, re.M
    )
    assert "http://" not in source and "https://" not in source


def test_gnani_info_marks_every_language_unsupported():
    stt, tts = GnaniSTTProvider(gnani_settings()), GnaniTTSProvider(gnani_settings())
    info = speech_info(stt, tts, gnani_settings())
    assert info.stt.available is False and info.tts.available is False
    assert info.tts.voices == []
    assert all(not lang.stt and not lang.tts and lang.tutor for lang in info.languages)


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


def test_factory_selects_gnani_placeholders(fresh_factory, monkeypatch):
    monkeypatch.setattr(get_settings(), "stt_provider", "gnani")
    monkeypatch.setattr(get_settings(), "tts_provider", "gnani")
    assert isinstance(get_stt(), GnaniSTTProvider)
    assert isinstance(get_tts(), GnaniTTSProvider)
    assert get_stt().unavailable_reason is not None
