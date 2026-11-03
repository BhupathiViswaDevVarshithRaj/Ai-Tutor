"""Speech requests: upload validation and provider calls behind the STT/TTS interfaces."""

from fastapi import Request

from app.ai.course_prompts import COURSE_LANGUAGE_NAMES
from app.ai.prompts import LANGUAGE_NAMES
from app.ai.speech.audio import ACCEPTED_AUDIO_TYPES, base_mime, sniff_container
from app.ai.speech.base import (
    AudioResult,
    ProviderNotConfigured,
    STTProvider,
    Transcript,
    TTSProvider,
)
from app.core.config import Settings
from app.core.errors import AppError
from app.schemas.speech import (
    LanguageSupport,
    SpeechInfo,
    SpeechLimits,
    SpeechProviderInfo,
    SynthesizeIn,
    TTSProviderInfo,
    VoiceOut,
)

# Shortest upload accepted: anything smaller cannot hold audible speech.
MIN_AUDIO_BYTES = 64


def speech_info(stt: STTProvider, tts: TTSProvider, settings: Settings) -> SpeechInfo:
    stt_ready, tts_ready = stt.unavailable_reason is None, tts.unavailable_reason is None
    stt_langs = set(stt.supported_languages()) if stt_ready else set()
    tts_langs = set(tts.supported_languages()) if tts_ready else set()
    return SpeechInfo(
        stt=SpeechProviderInfo(
            provider=stt.name,
            is_mock=stt.is_mock,
            available=stt_ready,
            unavailable_reason=stt.unavailable_reason,
            languages=sorted(stt_langs),
        ),
        tts=TTSProviderInfo(
            provider=tts.name,
            is_mock=tts.is_mock,
            available=tts_ready,
            unavailable_reason=tts.unavailable_reason,
            languages=sorted(tts_langs),
            voices=[
                VoiceOut(id=v.id, name=v.name, languages=list(v.languages))
                for v in (tts.voices() if tts_ready else ())
            ],
        ),
        languages=[
            LanguageSupport(
                code=code,
                name=name.split(" (")[0],
                tutor=code in LANGUAGE_NAMES,
                stt=code in stt_langs,
                tts=code in tts_langs,
            )
            for code, name in (LANGUAGE_NAMES | COURSE_LANGUAGE_NAMES).items()
        ],
        limits=SpeechLimits(
            max_audio_bytes=settings.speech_max_audio_bytes,
            max_tts_chars=settings.speech_max_tts_chars,
            audio_types=list(ACCEPTED_AUDIO_TYPES),
        ),
    )


def _require_ready(provider: STTProvider | TTSProvider, what: str) -> None:
    if provider.unavailable_reason is not None:
        raise ProviderNotConfigured(f"{what} is not available right now.")


async def read_audio(request: Request, settings: Settings) -> tuple[bytes, str]:
    """Read an uploaded audio body with a size cap; returns (bytes, base MIME type)."""
    mime = base_mime(request.headers.get("content-type"))
    if mime not in ACCEPTED_AUDIO_TYPES:
        raise AppError(
            415, "unsupported_audio", "Unsupported audio type. Use WebM, Ogg, WAV, MP3 or MP4."
        )
    limit = settings.speech_max_audio_bytes
    too_large = AppError(413, "audio_too_large", f"Audio is larger than {limit // 1_048_576} MB.")
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > limit:
        raise too_large
    chunks, size = [], 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > limit:
            raise too_large
        chunks.append(chunk)
    audio = b"".join(chunks)
    validate_audio(audio, mime, settings)
    return audio, mime


def validate_audio(audio: bytes, mime: str, settings: Settings) -> None:
    """Type, size and content checks shared by HTTP and WebSocket uploads."""
    if mime not in ACCEPTED_AUDIO_TYPES:
        raise AppError(
            415, "unsupported_audio", "Unsupported audio type. Use WebM, Ogg, WAV, MP3 or MP4."
        )
    if len(audio) > settings.speech_max_audio_bytes:
        limit = settings.speech_max_audio_bytes // 1_048_576
        raise AppError(413, "audio_too_large", f"Audio is larger than {limit} MB.")
    if len(audio) < MIN_AUDIO_BYTES:
        raise AppError(422, "audio_too_short", "The recording is empty or too short.")
    if sniff_container(audio) != ACCEPTED_AUDIO_TYPES[mime]:
        raise AppError(415, "unsupported_audio", "The file is not valid audio of the stated type.")


async def transcribe(
    stt: STTProvider, request: Request, language: str, settings: Settings
) -> Transcript:
    # Checked before reading the upload, so a disabled provider rejects requests cheaply.
    _require_ready(stt, "Speech recognition")
    audio, mime = await read_audio(request, settings)
    return await stt.transcribe(audio, mime_type=mime, language=language)


async def synthesize(tts: TTSProvider, data: SynthesizeIn, settings: Settings) -> AudioResult:
    _require_ready(tts, "Read-aloud")
    if len(data.text) > settings.speech_max_tts_chars:
        raise AppError(
            422,
            "text_too_long",
            f"Text is longer than {settings.speech_max_tts_chars} characters.",
        )
    return await tts.synthesize(
        data.text, language=data.language, voice=data.voice, speed=data.speed
    )
