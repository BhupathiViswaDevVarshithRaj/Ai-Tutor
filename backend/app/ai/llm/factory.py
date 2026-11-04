from functools import lru_cache

from app.ai.llm.base import LLMProvider
from app.core.config import Settings, get_settings


def provider_name(settings: Settings) -> str:
    """Which provider the settings select: an explicit choice, or by key when "auto"."""
    if settings.llm_provider != "auto":
        return settings.llm_provider
    if settings.anthropic_api_key:
        return "anthropic"
    if settings.groq_api_key:
        return "groq"
    return "mock"


@lru_cache
def get_llm() -> LLMProvider:
    """Configured provider: Anthropic or Groq with a key (or when forced), otherwise the mock."""
    settings = get_settings()
    name = provider_name(settings)
    if name == "anthropic":
        if not settings.anthropic_api_key:
            raise RuntimeError("LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is empty")
        from app.ai.llm.anthropic_provider import AnthropicProvider

        return AnthropicProvider(settings)
    if name == "groq":
        if not settings.groq_api_key:
            raise RuntimeError("LLM_PROVIDER=groq but GROQ_API_KEY is empty")
        from app.ai.llm.groq_provider import GroqProvider

        return GroqProvider(settings)

    from app.ai.llm.mock_provider import MockLLMProvider

    return MockLLMProvider(delay_seconds=settings.mock_stream_delay_seconds)


@lru_cache
def get_video_llm() -> LLMProvider:
    """Provider for Video Studio scripts: Groq with GROQ_VIDEO_API_KEY when that is set,
    otherwise the same provider as everything else."""
    settings = get_settings()
    if provider_name(settings) == "groq" and settings.groq_video_api_key:
        from app.ai.llm.groq_provider import GroqProvider

        return GroqProvider(settings, api_key=settings.groq_video_api_key)
    return get_llm()
