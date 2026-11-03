from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.schemas.common import AnyLanguage


class SynthesizeIn(BaseModel):
    # The configured maximum (SPEECH_MAX_TTS_CHARS) is enforced in the service.
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20000)]
    language: AnyLanguage
    voice: Annotated[str, StringConstraints(max_length=100)] | None = None
    speed: Annotated[float, Field(ge=0.5, le=2.0)] = 1.0


class TranscriptOut(BaseModel):
    text: str
    language: str
    confidence: float | None
    duration_ms: int | None
    provider: str
    is_mock: bool


class VoiceOut(BaseModel):
    id: str
    name: str
    languages: list[str]


class SpeechProviderInfo(BaseModel):
    provider: str
    is_mock: bool
    available: bool
    unavailable_reason: str | None
    languages: list[str]


class TTSProviderInfo(SpeechProviderInfo):
    voices: list[VoiceOut]


class LanguageSupport(BaseModel):
    code: str
    name: str
    tutor: bool
    stt: bool
    tts: bool


class SpeechLimits(BaseModel):
    max_audio_bytes: int
    max_tts_chars: int
    audio_types: list[str]


class SpeechInfo(BaseModel):
    stt: SpeechProviderInfo
    tts: TTSProviderInfo
    languages: list[LanguageSupport]
    limits: SpeechLimits
