from functools import lru_cache

from app.ai.speech.base import STTProvider, TTSProvider
from app.core.config import get_settings


@lru_cache
def get_stt() -> STTProvider:
    """Configured speech-to-text provider (STT_PROVIDER=mock|gnani)."""
    settings = get_settings()
    if settings.stt_provider == "gnani":
        from app.ai.speech.gnani import GnaniSTTProvider

        return GnaniSTTProvider(settings)

    from app.ai.speech.mock import MockSTTProvider

    return MockSTTProvider()


@lru_cache
def get_tts() -> TTSProvider:
    """Configured text-to-speech provider (TTS_PROVIDER=mock|gnani)."""
    settings = get_settings()
    if settings.tts_provider == "gnani":
        from app.ai.speech.gnani import GnaniTTSProvider

        return GnaniTTSProvider(settings)

    from app.ai.speech.mock import MockTTSProvider

    return MockTTSProvider()
