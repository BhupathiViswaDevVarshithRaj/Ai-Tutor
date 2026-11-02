"""Claude via the official Anthropic SDK (async)."""

import logging
from collections.abc import AsyncIterator
from typing import Any

import anthropic

from app.ai.llm.base import (
    ChatMessage,
    LLMError,
    LLMRefusal,
    ModelRole,
    ParseResult,
    StreamDone,
    StreamEvent,
    T,
    TextDelta,
    Usage,
)
from app.core.config import Settings

logger = logging.getLogger(__name__)

# Server-side refusal fallback: a declined request is re-run on Anthropic's recommended
# fallback model for that refusal category, inside the same call.
FALLBACK_BETA = "server-side-fallback-2026-07-01"


def _usage(raw: Any) -> Usage:
    if raw is None:
        return Usage()
    return Usage(
        input_tokens=getattr(raw, "input_tokens", None),
        output_tokens=getattr(raw, "output_tokens", None),
        cache_read_input_tokens=getattr(raw, "cache_read_input_tokens", None),
    )


def _map_error(exc: Exception) -> LLMError:
    if isinstance(exc, anthropic.RateLimitError):
        return LLMError("The tutor is busy right now. Please try again in a moment.")
    if isinstance(exc, anthropic.AuthenticationError | anthropic.PermissionDeniedError):
        logger.error("Anthropic credentials rejected: %s", exc)
        return LLMError("The AI service isn't configured correctly.", retryable=False)
    if isinstance(exc, anthropic.APIStatusError):
        logger.error("Anthropic API error %s: %s", exc.status_code, exc)
        return LLMError("The tutor ran into a problem. Please try again.")
    if isinstance(exc, anthropic.APIConnectionError):  # includes APITimeoutError
        return LLMError("Couldn't reach the AI service. Please try again.")
    logger.exception("Unexpected LLM failure", exc_info=exc)
    return LLMError("The tutor ran into a problem. Please try again.")


class AnthropicProvider:
    name = "anthropic"
    is_mock = False

    def __init__(self, settings: Settings, client: anthropic.AsyncAnthropic | None = None) -> None:
        self.settings = settings
        self.client = client or anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key,
            timeout=settings.llm_timeout_seconds,
            max_retries=settings.llm_max_retries,
        )

    def model_for(self, role: ModelRole) -> str:
        s = self.settings
        return s.llm_model_tutor if role == "tutor" else s.llm_model_structured

    def _effort(self, role: ModelRole) -> str:
        s = self.settings
        return s.llm_effort_tutor if role == "tutor" else s.llm_effort_structured

    def _common(self, system: str, messages: list[ChatMessage], role: ModelRole) -> dict:
        return {
            "model": self.model_for(role),
            "max_tokens": self.settings.llm_max_tokens,
            # The system prompt is stable for a lesson, so cache it.
            "system": [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "output_config": {"effort": self._effort(role)},
            "betas": [FALLBACK_BETA],
            "fallbacks": "default",
        }

    async def stream_chat(
        self, *, system: str, messages: list[ChatMessage], role: ModelRole = "tutor"
    ) -> AsyncIterator[StreamEvent]:
        try:
            async with self.client.beta.messages.stream(
                **self._common(system, messages, role)
            ) as stream:
                async for text in stream.text_stream:
                    yield TextDelta(text)
                final = await stream.get_final_message()
        except LLMError:
            raise
        except Exception as exc:  # noqa: BLE001 - mapped to a safe user-facing error
            raise _map_error(exc) from exc

        if final.stop_reason == "refusal":
            raise LLMRefusal()
        yield StreamDone(
            model=final.model, usage=_usage(final.usage), stop_reason=final.stop_reason
        )

    async def parse(
        self,
        *,
        system: str,
        messages: list[ChatMessage],
        schema: type[T],
        role: ModelRole = "structured",
    ) -> ParseResult[T]:
        try:
            response = await self.client.beta.messages.parse(
                **self._common(system, messages, role), output_format=schema
            )
        except Exception as exc:  # noqa: BLE001
            raise _map_error(exc) from exc

        if response.stop_reason == "refusal":
            raise LLMRefusal()
        if response.stop_reason == "max_tokens" or response.parsed_output is None:
            raise LLMError("The tutor's answer was cut off. Please try again.")
        return ParseResult(
            value=response.parsed_output, model=response.model, usage=_usage(response.usage)
        )
