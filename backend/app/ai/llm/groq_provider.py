"""Open models on Groq via the official Groq SDK (async).

Structured output uses Groq's strict `json_schema` mode, which needs every property listed in
`required` and every object closed (`additionalProperties: false`). `strict_schema` converts a
Pydantic schema to that form; the result is still validated against the Pydantic model, and a
reply that fails validation is retried with the validation error, and one Groq rejects as
breaking the schema (400 json_validate_failed) is sampled again, up to PARSE_ATTEMPTS calls.
"""

import copy
import json
import logging
from collections.abc import AsyncIterator
from typing import Any

import groq
from pydantic import ValidationError

from app.ai.llm.base import (
    ChatMessage,
    LLMError,
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

# Keywords moved into the description: strict mode guarantees the shape, Pydantic the limits.
_LIMITS = {
    "minLength": "at least {} characters",
    "maxLength": "at most {} characters",
    "minItems": "at least {} items",
    "maxItems": "at most {} items",
    "minimum": "minimum {}",
    "maximum": "maximum {}",
    "exclusiveMinimum": "greater than {}",
    "exclusiveMaximum": "less than {}",
    "pattern": "matching {}",
}
_DROP = {"default", "format", "discriminator", "uniqueItems"}
PARSE_ATTEMPTS = 3


def strict_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """A Pydantic JSON schema rewritten for Groq strict mode (see module docstring)."""

    def visit(node: Any) -> Any:
        if isinstance(node, list):
            return [visit(item) for item in node]
        if not isinstance(node, dict):
            return node
        out: dict[str, Any] = {}
        notes: list[str] = []
        for key, value in node.items():
            if key in _LIMITS and not isinstance(value, dict):
                notes.append(_LIMITS[key].format(value))
            elif key in _DROP:
                continue
            elif key in ("properties", "$defs"):
                out[key] = {name: visit(sub) for name, sub in value.items()}
            else:
                out[key] = visit(value)
        if "properties" in out:
            out["type"] = "object"
            out["required"] = list(out["properties"])
            out["additionalProperties"] = False
        if notes:
            text = "; ".join(notes)
            out["description"] = f"{out['description']} ({text})" if "description" in out else text
        return out

    return visit(copy.deepcopy(schema))


def _usage(raw: Any) -> Usage:
    if raw is None:
        return Usage()
    return Usage(
        input_tokens=getattr(raw, "prompt_tokens", None),
        output_tokens=getattr(raw, "completion_tokens", None),
    )


def _error_code(exc: groq.APIStatusError) -> str | None:
    body = exc.body if isinstance(exc.body, dict) else {}
    error = body.get("error", body)
    return error.get("code") if isinstance(error, dict) else None


def _map_error(exc: Exception) -> LLMError:
    if isinstance(exc, groq.RateLimitError):
        return LLMError("The tutor is busy right now. Please try again in a moment.")
    if isinstance(exc, groq.AuthenticationError | groq.PermissionDeniedError):
        logger.error("Groq credentials rejected: %s", exc)
        return LLMError("The AI service isn't configured correctly.", retryable=False)
    if isinstance(exc, groq.APIStatusError):
        logger.error("Groq API error %s: %s", exc.status_code, exc)
        return LLMError("The tutor ran into a problem. Please try again.")
    if isinstance(exc, groq.APIConnectionError):  # includes APITimeoutError
        return LLMError("Couldn't reach the AI service. Please try again.")
    logger.exception("Unexpected LLM failure", exc_info=exc)
    return LLMError("The tutor ran into a problem. Please try again.")


class GroqProvider:
    name = "groq"
    is_mock = False

    def __init__(
        self,
        settings: Settings,
        client: groq.AsyncGroq | None = None,
        api_key: str | None = None,
    ) -> None:
        self.settings = settings
        self.client = client or groq.AsyncGroq(
            api_key=api_key or settings.groq_api_key,
            timeout=settings.llm_timeout_seconds,
            max_retries=settings.llm_max_retries,
        )

    def model_for(self, role: ModelRole) -> str:
        s = self.settings
        return s.groq_model_tutor if role == "tutor" else s.groq_model_structured

    def _messages(self, system: str, messages: list[ChatMessage]) -> list[dict[str, str]]:
        return [
            {"role": "system", "content": system},
            *({"role": m.role, "content": m.content} for m in messages),
        ]

    async def stream_chat(
        self, *, system: str, messages: list[ChatMessage], role: ModelRole = "tutor"
    ) -> AsyncIterator[StreamEvent]:
        model, usage, finish = self.model_for(role), Usage(), None
        try:
            stream = await self.client.chat.completions.create(
                model=model,
                messages=self._messages(system, messages),
                max_completion_tokens=self.settings.llm_max_tokens,
                stream=True,
            )
            async for chunk in stream:
                model = chunk.model or model
                # Groq reports usage on the last chunk, under `x_groq`.
                x_groq = getattr(chunk, "x_groq", None)
                if x_groq is not None and getattr(x_groq, "usage", None) is not None:
                    usage = _usage(x_groq.usage)
                if not chunk.choices:
                    continue
                choice = chunk.choices[0]
                if choice.delta.content:
                    yield TextDelta(choice.delta.content)
                finish = choice.finish_reason or finish
        except LLMError:
            raise
        except Exception as exc:  # noqa: BLE001 - mapped to a safe user-facing error
            raise _map_error(exc) from exc
        yield StreamDone(model=model, usage=usage, stop_reason=finish)

    async def parse(
        self,
        *,
        system: str,
        messages: list[ChatMessage],
        schema: type[T],
        role: ModelRole = "structured",
    ) -> ParseResult[T]:
        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": schema.__name__,
                "strict": True,
                "schema": strict_schema(schema.model_json_schema()),
            },
        }
        conversation = self._messages(system, messages)
        for attempt in range(PARSE_ATTEMPTS):
            try:
                response = await self.client.chat.completions.create(
                    model=self.model_for(role),
                    messages=conversation,
                    max_completion_tokens=self.settings.llm_max_tokens,
                    response_format=response_format,
                )
            except groq.BadRequestError as exc:
                # Groq checks strict output itself and answers 400 json_validate_failed when
                # the model broke the schema (e.g. a misspelt key): sample again.
                if _error_code(exc) != "json_validate_failed":
                    raise _map_error(exc) from exc
                logger.warning("Groq output broke the schema (attempt %d)", attempt + 1)
                continue
            except Exception as exc:  # noqa: BLE001
                raise _map_error(exc) from exc

            choice = response.choices[0]
            if choice.finish_reason == "length":
                raise LLMError("The tutor's answer was cut off. Please try again.")
            content = choice.message.content or ""
            try:
                value = schema.model_validate(json.loads(content))
            except (json.JSONDecodeError, ValidationError) as exc:
                logger.warning("Groq structured output invalid (attempt %d): %s", attempt + 1, exc)
                conversation = [
                    *conversation,
                    {"role": "assistant", "content": content},
                    {
                        "role": "user",
                        "content": f"That JSON did not pass validation: {exc}. "
                        "Reply again with corrected JSON only.",
                    },
                ]
                continue
            return ParseResult(value=value, model=response.model, usage=_usage(response.usage))
        raise LLMError("The tutor's answer came back in the wrong format. Please try again.")
