"""Provider-neutral LLM interface used by the AI tutor services."""

from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Generic, Literal, Protocol, TypeVar

from pydantic import BaseModel

ModelRole = Literal["tutor", "structured"]
T = TypeVar("T", bound=BaseModel)


@dataclass(frozen=True)
class ChatMessage:
    role: Literal["user", "assistant"]
    content: str


@dataclass
class Usage:
    input_tokens: int | None = None
    output_tokens: int | None = None
    cache_read_input_tokens: int | None = None


@dataclass(frozen=True)
class TextDelta:
    text: str


@dataclass(frozen=True)
class StreamDone:
    model: str
    usage: Usage = field(default_factory=Usage)
    stop_reason: str | None = None


StreamEvent = TextDelta | StreamDone


@dataclass
class ParseResult(Generic[T]):  # noqa: UP046 - PEP 695 syntax needs Python 3.12
    value: T
    model: str
    usage: Usage = field(default_factory=Usage)


class LLMError(Exception):
    """The model call failed; `user_message` is safe to show to learners."""

    def __init__(self, user_message: str, *, retryable: bool = True) -> None:
        super().__init__(user_message)
        self.user_message = user_message
        self.retryable = retryable


class LLMRefusal(LLMError):
    def __init__(self) -> None:
        super().__init__(
            "The tutor can't help with that request. "
            "Try rephrasing or asking about something else.",
            retryable=False,
        )


class LLMProvider(Protocol):
    name: str
    is_mock: bool

    def model_for(self, role: ModelRole) -> str: ...

    def stream_chat(
        self, *, system: str, messages: list[ChatMessage], role: ModelRole = "tutor"
    ) -> AsyncIterator[StreamEvent]:
        """Yield TextDelta chunks, then exactly one StreamDone. Raises LLMError/LLMRefusal."""
        ...

    async def parse(
        self,
        *,
        system: str,
        messages: list[ChatMessage],
        schema: type[T],
        role: ModelRole = "structured",
    ) -> ParseResult[T]:
        """Return output validated against `schema`. Raises LLMError/LLMRefusal."""
        ...
