"""Provider-neutral speech interfaces (speech-to-text and text-to-speech)."""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class Transcript:
    text: str
    language: str
    # Provider confidence in [0, 1], when the provider reports one.
    confidence: float | None = None
    duration_ms: int | None = None


@dataclass(frozen=True)
class AudioResult:
    audio: bytes
    mime_type: str
    duration_ms: int
    voice: str


@dataclass(frozen=True)
class Voice:
    id: str
    name: str
    languages: tuple[str, ...]


class SpeechError(Exception):
    """A speech call failed; `user_message` is safe to show to learners."""

    def __init__(self, user_message: str, *, retryable: bool = True) -> None:
        super().__init__(user_message)
        self.user_message = user_message
        self.retryable = retryable


class ProviderNotConfigured(SpeechError):
    """The selected provider is disabled, missing credentials, or not implemented yet."""

    def __init__(self, user_message: str) -> None:
        super().__init__(user_message, retryable=False)


class UnsupportedLanguage(SpeechError):
    def __init__(self, language: str, capability: str) -> None:
        super().__init__(
            f"{capability} is not available for language '{language}' yet.", retryable=False
        )


class STTProvider(Protocol):
    name: str
    is_mock: bool
    # Why the provider cannot serve requests (disabled, unconfigured, unimplemented), or None.
    unavailable_reason: str | None

    def supported_languages(self) -> tuple[str, ...]: ...

    async def transcribe(self, audio: bytes, *, mime_type: str, language: str) -> Transcript: ...


class TTSProvider(Protocol):
    name: str
    is_mock: bool
    unavailable_reason: str | None

    def supported_languages(self) -> tuple[str, ...]: ...

    def voices(self) -> tuple[Voice, ...]: ...

    async def synthesize(
        self, text: str, *, language: str, voice: str | None = None, speed: float = 1.0
    ) -> AudioResult: ...
