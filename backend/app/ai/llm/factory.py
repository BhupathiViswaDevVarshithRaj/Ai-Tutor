from functools import lru_cache

from app.ai.llm.base import LLMProvider
from app.core.config import get_settings


@lru_cache
def get_llm() -> LLMProvider:
    """Configured provider: Anthropic with a key (or when forced), otherwise the mock."""
    settings = get_settings()
    use_anthropic = settings.llm_provider == "anthropic" or (
        settings.llm_provider == "auto" and bool(settings.anthropic_api_key)
    )
    if use_anthropic:
        if not settings.anthropic_api_key:
            raise RuntimeError("LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is empty")
        from app.ai.llm.anthropic_provider import AnthropicProvider

        return AnthropicProvider(settings)

    from app.ai.llm.mock_provider import MockLLMProvider

    return MockLLMProvider(delay_seconds=settings.mock_stream_delay_seconds)
