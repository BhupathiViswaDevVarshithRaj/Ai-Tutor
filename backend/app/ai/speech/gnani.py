"""Gnani speech adapters: deliberately disabled placeholders.

The real integration is written only after Gnani's official API documentation is provided
(see DECISIONS.md D-008). Until then these classes contain NO endpoints, authentication scheme
or request/response formats, and never make network calls. Every call raises
`ProviderNotConfigured` with the reason, and the speech info endpoint reports it.
"""

from app.ai.speech.base import AudioResult, ProviderNotConfigured, Transcript, Voice
from app.core.config import Settings

NOT_IMPLEMENTED = (
    "Gnani speech integration is not implemented yet. "
    "It will be added once the official API documentation is available."
)


def _unavailable_reason(enabled: bool, settings: Settings) -> str:
    if not enabled:
        return "Gnani is selected but disabled (GNANI_*_ENABLED=false)."
    if not settings.gnani_api_key or not settings.gnani_api_base_url:
        return "Gnani is enabled but GNANI_API_KEY or GNANI_API_BASE_URL is not set."
    return NOT_IMPLEMENTED


class GnaniSTTProvider:
    name = "gnani"
    is_mock = False

    def __init__(self, settings: Settings) -> None:
        self.unavailable_reason: str | None = _unavailable_reason(
            settings.gnani_stt_enabled, settings
        )

    def supported_languages(self) -> tuple[str, ...]:
        # Unknown until the documentation confirms which languages Gnani supports.
        return ()

    async def transcribe(self, audio: bytes, *, mime_type: str, language: str) -> Transcript:
        raise ProviderNotConfigured(
            "Speech recognition is not available right now. Please type your message instead."
        )


class GnaniTTSProvider:
    name = "gnani"
    is_mock = False

    def __init__(self, settings: Settings) -> None:
        self.unavailable_reason: str | None = _unavailable_reason(
            settings.gnani_tts_enabled, settings
        )

    def supported_languages(self) -> tuple[str, ...]:
        return ()

    def voices(self) -> tuple[Voice, ...]:
        return ()

    async def synthesize(
        self, text: str, *, language: str, voice: str | None = None, speed: float = 1.0
    ) -> AudioResult:
        raise ProviderNotConfigured(
            "Read-aloud is not available right now. You can still read the text."
        )
