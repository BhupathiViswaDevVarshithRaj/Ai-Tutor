"""Gnani (Vachana) speech providers, written to Gnani's official API documentation.

Docs: https://docs.gnani.ai/api/introduction/quick-start.md
- Auth: the API key in the `X-API-Key-ID` header.
- STT: POST {base}/stt/v3, multipart (`audio_file`, `language_code`), Prisma v2.5 by default.
  Accepts WAV/MP3/OGG/FLAC/AAC/M4A up to 30 s; replies JSON with `success` and `transcript`.
- TTS: POST {base}/api/v1/tts/inference, JSON (`text`, `voice`, `model`, `language`, `speed`,
  `audio_config`); replies with raw audio in the requested container.
  Voices: https://docs.gnani.ai/api/TTS/available-voices.md (Timbre v2.5 voices each have one
  preferred language).

Browser recordings (WebM/Opus, which Gnani doesn't list) are decoded to WAV first, and longer
recordings are sent in pieces under the 30 s limit.
"""

import logging

import httpx

from app.ai.speech.audio import (
    AudioDecodeError,
    decode_to_wav,
    rewrite_wav,
    split_wav,
    wav_duration_ms,
)
from app.ai.speech.base import (
    AudioResult,
    ProviderNotConfigured,
    SpeechError,
    Transcript,
    UnsupportedLanguage,
    Voice,
)
from app.core.config import Settings

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://api.vachana.ai"
API_KEY_HEADER = "X-API-Key-ID"
STT_PATH = "/stt/v3"
TTS_PATH = "/api/v1/tts/inference"

# App language code -> Gnani language code (the ten Indian languages both APIs support).
LANGUAGE_CODES = {
    "en": "en-IN",
    "hi": "hi-IN",
    "te": "te-IN",
    "ta": "ta-IN",
    "pa": "pa-IN",
    "bn": "bn-IN",
    "kn": "kn-IN",
    "ml": "ml-IN",
    "mr": "mr-IN",
    "gu": "gu-IN",
}
# Documented limit is 30 s; pieces stay a little under it.
STT_MAX_MS = 28_000

# Timbre v2.5 voices, by preferred language; the first is the default for that language.
VOICES: dict[str, tuple[str, ...]] = {
    "en": ("Kaveri", "Pranav", "Trupti", "Shlok"),
    "hi": ("Nalini", "Deepak", "Bhavna", "Vikrant"),
    "te": ("Suhana", "Lavanya"),
    "ta": ("Asmita", "Trisha"),
    "pa": ("Mehuli", "Zayan"),
    "bn": ("Kirra", "Dhruva"),
    "kn": ("Saanvi", "Kavin"),
    "ml": ("Reshma", "Riyaan"),
    "mr": ("Zahira", "Ishaan"),
    "gu": ("Falak", "Veera"),
}
LANGUAGE_NAMES = {
    "en": "English", "hi": "Hindi", "te": "Telugu", "ta": "Tamil", "pa": "Punjabi",
    "bn": "Bengali", "kn": "Kannada", "ml": "Malayalam", "mr": "Marathi", "gu": "Gujarati",
}  # fmt: skip
# The documented example format: 48 kHz, 16-bit mono PCM in a WAV container.
AUDIO_CONFIG = {
    "sample_rate": 48000,
    "num_channels": 1,
    "sample_width": 2,
    "encoding": "linear_pcm",
    "container": "wav",
}


def _unavailable_reason(enabled: bool, settings: Settings) -> str | None:
    if not enabled:
        return "Gnani is selected but disabled (GNANI_*_ENABLED=false)."
    if not settings.gnani_api_key:
        return "Gnani is enabled but GNANI_API_KEY is not set."
    return None


def _error_for(response: httpx.Response, what: str) -> SpeechError:
    try:
        detail = response.json().get("message")
    except ValueError:
        detail = None
    logger.error("Gnani %s failed: HTTP %s %s", what, response.status_code, detail)
    if response.status_code in (401, 403):
        return SpeechError("The speech service isn't configured correctly.", retryable=False)
    if response.status_code == 429:
        return SpeechError("The speech service is busy. Please try again in a moment.")
    if response.status_code >= 500:
        return SpeechError(f"{what} ran into a problem. Please try again.")
    return SpeechError(f"{what} couldn't process that. Please try again.", retryable=False)


class _GnaniClient:
    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None) -> None:
        self.settings = settings
        self.transport = transport

    async def post(self, path: str, what: str, **kwargs) -> httpx.Response:
        s = self.settings
        try:
            async with httpx.AsyncClient(
                base_url=s.gnani_api_base_url or DEFAULT_BASE_URL,
                headers={API_KEY_HEADER: s.gnani_api_key},
                timeout=s.gnani_timeout_seconds,
                transport=self.transport,
            ) as client:
                response = await client.post(path, **kwargs)
        except httpx.TimeoutException as exc:
            raise SpeechError(f"{what} took too long. Please try again.") from exc
        except httpx.HTTPError as exc:
            logger.error("Gnani %s unreachable: %s", what, exc)
            raise SpeechError("Couldn't reach the speech service. Please try again.") from exc
        if response.status_code != 200:
            raise _error_for(response, what)
        return response


class GnaniSTTProvider:
    name = "gnani"
    is_mock = False

    def __init__(
        self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None
    ) -> None:
        self.unavailable_reason = _unavailable_reason(settings.gnani_stt_enabled, settings)
        self.client = _GnaniClient(settings, transport)

    def supported_languages(self) -> tuple[str, ...]:
        return tuple(LANGUAGE_CODES)

    async def transcribe(self, audio: bytes, *, mime_type: str, language: str) -> Transcript:
        if self.unavailable_reason is not None:
            raise ProviderNotConfigured(
                "Speech recognition is not available right now. Please type your message instead."
            )
        if language not in LANGUAGE_CODES:
            raise UnsupportedLanguage(language, "Speech recognition")

        # Everything is sent as 16 kHz mono WAV: inside the documented 8-44.1 kHz range, with a
        # known length so long recordings can be split.
        try:
            audio = decode_to_wav(audio)
        except AudioDecodeError as exc:
            logger.warning("Undecodable %s upload: %s", mime_type, exc)
            raise SpeechError(
                "We couldn't read that recording. Please try again.", retryable=False
            ) from exc
        duration = wav_duration_ms(audio)
        pieces = split_wav(audio, STT_MAX_MS) if duration and duration > STT_MAX_MS else [audio]

        texts = []
        for piece in pieces:
            response = await self.client.post(
                STT_PATH,
                "Speech recognition",
                files={"audio_file": ("speech.wav", piece, "audio/wav")},
                data={"language_code": LANGUAGE_CODES[language]},
            )
            body = response.json()
            if not body.get("success"):
                logger.error("Gnani STT unsuccessful: %s", body.get("message"))
                raise SpeechError("Speech recognition ran into a problem. Please try again.")
            if text := (body.get("transcript") or "").strip():
                texts.append(text)
        return Transcript(text=" ".join(texts), language=language, duration_ms=duration)


class GnaniTTSProvider:
    name = "gnani"
    is_mock = False

    def __init__(
        self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None
    ) -> None:
        self.settings = settings
        self.unavailable_reason = _unavailable_reason(settings.gnani_tts_enabled, settings)
        self.client = _GnaniClient(settings, transport)

    def supported_languages(self) -> tuple[str, ...]:
        return tuple(VOICES)

    def voices(self) -> tuple[Voice, ...]:
        return tuple(
            Voice(id=name, name=f"{name} ({LANGUAGE_NAMES[lang]})", languages=(lang,))
            for lang, names in VOICES.items()
            for name in names
        )

    async def synthesize(
        self, text: str, *, language: str, voice: str | None = None, speed: float = 1.0
    ) -> AudioResult:
        if self.unavailable_reason is not None:
            raise ProviderNotConfigured(
                "Read-aloud is not available right now. You can still read the text."
            )
        if language not in VOICES:
            raise UnsupportedLanguage(language, "Speech")
        # A saved voice for another language falls back to this language's default voice.
        voice_id = voice if voice in VOICES[language] else VOICES[language][0]
        response = await self.client.post(
            TTS_PATH,
            "Read-aloud",
            json={
                "text": text,
                "voice": voice_id,
                "model": self.settings.gnani_tts_model,
                "language": LANGUAGE_CODES[language],
                "speed": speed,
                "audio_config": AUDIO_CONFIG,
            },
        )
        duration = wav_duration_ms(response.content)
        if duration is None:
            logger.error("Gnani TTS returned %s, not WAV", response.headers.get("content-type"))
            raise SpeechError("Read-aloud ran into a problem. Please try again.")
        # Gnani streams its WAV with 0xFFFFFFFF as the length; state the real one for players.
        return AudioResult(
            audio=rewrite_wav(response.content),
            mime_type="audio/wav",
            duration_ms=duration,
            voice=voice_id,
        )
