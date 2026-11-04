"""Unit tests for the Groq adapter (fake SDK client, no network) and its strict schemas."""

import json
from types import SimpleNamespace

import groq
import httpx
import pytest
from pydantic import BaseModel, Field

from app.ai.llm.base import ChatMessage, LLMError, StreamDone, TextDelta
from app.ai.llm.factory import get_llm, get_video_llm
from app.ai.llm.groq_provider import GroqProvider, strict_schema
from app.ai.quiz import QuizDraft
from app.ai.schemas import LessonPlan
from app.core.config import Settings, get_settings

PLAN = {"title": "t", "overview": "o", "prerequisites": [], "modules": []}


def chunk(content=None, finish=None, usage=None):
    return SimpleNamespace(
        model="openai/gpt-oss-120b",
        choices=[SimpleNamespace(delta=SimpleNamespace(content=content), finish_reason=finish)],
        x_groq=SimpleNamespace(usage=usage) if usage else None,
    )


async def aiter(items):
    for item in items:
        yield item


class FakeCompletions:
    """Replies with stream chunks (stream=True) or with each of `replies` in turn.

    `error` is raised on every call; each of `errors` once, before any reply.
    """

    def __init__(self, *, chunks=(), replies=(), finish="stop", error=None, errors=()):
        self.chunks, self.replies, self.finish, self.error = chunks, list(replies), finish, error
        self.errors = list(errors)
        self.calls: list[dict] = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        if self.errors:
            raise self.errors.pop(0)
        if kwargs.get("stream"):
            return aiter(self.chunks)
        message = SimpleNamespace(content=self.replies.pop(0))
        return SimpleNamespace(
            model="openai/gpt-oss-120b",
            choices=[SimpleNamespace(message=message, finish_reason=self.finish)],
            usage=SimpleNamespace(prompt_tokens=20, completion_tokens=9),
        )


def provider_with(fake: FakeCompletions) -> GroqProvider:
    client = SimpleNamespace(chat=SimpleNamespace(completions=fake))
    return GroqProvider(Settings(groq_api_key="gsk-test"), client=client)


async def test_stream_sends_system_first_and_yields_deltas():
    usage = SimpleNamespace(prompt_tokens=12, completion_tokens=3)
    fake = FakeCompletions(chunks=[chunk("Hel"), chunk("lo"), chunk(None, "stop", usage)])
    events = [
        e
        async for e in provider_with(fake).stream_chat(
            system="SYS", messages=[ChatMessage("user", "Hi")]
        )
    ]
    assert events[:2] == [TextDelta("Hel"), TextDelta("lo")]
    done = events[-1]
    assert isinstance(done, StreamDone) and done.stop_reason == "stop"
    assert done.usage.input_tokens == 12 and done.usage.output_tokens == 3
    (call,) = fake.calls
    assert call["model"] == "openai/gpt-oss-120b" and call["stream"] is True
    assert call["messages"] == [
        {"role": "system", "content": "SYS"},
        {"role": "user", "content": "Hi"},
    ]


async def test_sdk_errors_become_safe_llm_errors():
    fake = FakeCompletions(error=RuntimeError("boom with internal details"))
    with pytest.raises(LLMError) as info:
        async for _ in provider_with(fake).stream_chat(
            system="S", messages=[ChatMessage("user", "x")]
        ):
            pass
    assert "internal details" not in info.value.user_message


async def test_parse_uses_strict_json_schema_and_validates():
    fake = FakeCompletions(replies=[json.dumps(PLAN)])
    result = await provider_with(fake).parse(
        system="S", messages=[ChatMessage("user", "x")], schema=LessonPlan
    )
    assert result.value == LessonPlan(**PLAN)
    assert result.usage.input_tokens == 20
    response_format = fake.calls[0]["response_format"]
    assert response_format["type"] == "json_schema"
    assert response_format["json_schema"]["strict"] is True
    assert response_format["json_schema"]["name"] == "LessonPlan"


async def test_parse_retries_once_with_the_validation_error():
    fake = FakeCompletions(replies=['{"title": "only a title"}', json.dumps(PLAN)])
    result = await provider_with(fake).parse(
        system="S", messages=[ChatMessage("user", "x")], schema=LessonPlan
    )
    assert result.value.title == "t"
    retry = fake.calls[1]["messages"]
    assert retry[-2] == {"role": "assistant", "content": '{"title": "only a title"}'}
    assert "did not pass validation" in retry[-1]["content"]


def bad_request(code: str) -> groq.BadRequestError:
    request = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
    return groq.BadRequestError(
        "400",
        response=httpx.Response(400, request=request),
        body={"error": {"code": code, "message": "nope"}},
    )


async def test_parse_samples_again_when_groq_rejects_the_schema():
    fake = FakeCompletions(errors=[bad_request("json_validate_failed")], replies=[json.dumps(PLAN)])
    result = await provider_with(fake).parse(
        system="S", messages=[ChatMessage("user", "x")], schema=LessonPlan
    )
    assert result.value.title == "t" and len(fake.calls) == 2
    # Any other bad request is a real error, not retried.
    other = FakeCompletions(errors=[bad_request("model_not_found")], replies=[json.dumps(PLAN)])
    with pytest.raises(LLMError):
        await provider_with(other).parse(
            system="S", messages=[ChatMessage("user", "x")], schema=LessonPlan
        )
    assert len(other.calls) == 1


async def test_parse_gives_up_after_three_bad_replies_and_on_truncation():
    bad = FakeCompletions(replies=["not json", "still not json", "nor this"])
    with pytest.raises(LLMError, match="wrong format"):
        await provider_with(bad).parse(
            system="S", messages=[ChatMessage("user", "x")], schema=LessonPlan
        )
    cut = FakeCompletions(replies=["{"], finish="length")
    with pytest.raises(LLMError, match="cut off"):
        await provider_with(cut).parse(
            system="S", messages=[ChatMessage("user", "x")], schema=LessonPlan
        )


def _objects(node):
    if isinstance(node, dict):
        if "properties" in node:
            yield node
        for value in node.values():
            yield from _objects(value)
    elif isinstance(node, list):
        for item in node:
            yield from _objects(item)


class Limited(BaseModel):
    name: str = Field(min_length=2, max_length=40, description="A name")
    tags: list[str] = Field(default_factory=list, max_length=3)


def test_strict_schema_closes_every_object():
    objects = list(_objects(strict_schema(QuizDraft.model_json_schema())))
    assert len(objects) >= 2  # the quiz and its questions
    for obj in objects:
        assert obj["additionalProperties"] is False
        assert obj["required"] == list(obj["properties"])


def test_strict_schema_moves_limits_into_descriptions():
    schema = strict_schema(Limited.model_json_schema())
    assert schema["required"] == ["name", "tags"]  # defaults become required too
    assert schema["properties"]["name"]["description"] == (
        "A name (at most 40 characters; at least 2 characters)"
    )
    assert schema["properties"]["tags"]["description"] == "at most 3 items"
    text = json.dumps(schema)
    for keyword in ('"maxItems"', '"minLength"', '"maxLength"', '"default"'):
        assert keyword not in text


# --- provider selection ------------------------------------------------------


@pytest.fixture
def fresh_factory():
    get_llm.cache_clear()
    yield
    get_llm.cache_clear()


def test_factory_auto_prefers_anthropic_then_groq(fresh_factory, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "llm_provider", "auto")
    monkeypatch.setattr(settings, "groq_api_key", "gsk-test")
    assert isinstance(get_llm(), GroqProvider)


def test_video_studio_uses_its_own_key_when_set(fresh_factory, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "llm_provider", "groq")
    monkeypatch.setattr(settings, "groq_api_key", "gsk-tutor")
    get_video_llm.cache_clear()
    assert get_video_llm() is get_llm()  # no video key: the shared provider
    monkeypatch.setattr(settings, "groq_video_api_key", "gsk-video")
    get_video_llm.cache_clear()
    video = get_video_llm()
    assert isinstance(video, GroqProvider) and video is not get_llm()
    assert video.client.api_key == "gsk-video" and get_llm().client.api_key == "gsk-tutor"
    get_video_llm.cache_clear()


def test_factory_refuses_forced_groq_without_key(fresh_factory, monkeypatch):
    monkeypatch.setattr(get_settings(), "llm_provider", "groq")
    monkeypatch.setattr(get_settings(), "groq_api_key", "")
    with pytest.raises(RuntimeError):
        get_llm()
