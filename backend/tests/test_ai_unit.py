"""Unit tests for prompts, output validation, provider selection and the Claude adapter."""

from types import SimpleNamespace

import pytest

from app.ai.llm.anthropic_provider import FALLBACK_BETA, AnthropicProvider
from app.ai.llm.base import ChatMessage, LLMError, LLMRefusal, StreamDone, TextDelta
from app.ai.llm.factory import get_llm
from app.ai.llm.mock_provider import MockLLMProvider
from app.ai.prompts import tutor_system_prompt
from app.ai.schemas import LessonPlan, PlanModule, PlanSection, validate_plan
from app.core.config import Settings, get_settings
from app.db.enums import LearningLevel

# --- prompts -----------------------------------------------------------------


def test_system_prompt_adapts_to_level_and_language():
    beginner = tutor_system_prompt(
        level=LearningLevel.BEGINNER, language="ta", interests=[], topic="Gravity", plan=None
    )
    advanced = tutor_system_prompt(
        level=LearningLevel.ADVANCED, language="en", interests=[], topic="Gravity", plan=None
    )
    assert "BEGINNER" in beginner and "Assume no prior knowledge" in beginner
    assert "Tamil" in beginner and "native script" in beginner
    assert "ADVANCED" in advanced and "rigorous" in advanced
    assert "simple English" in advanced
    assert "check" in beginner.lower()  # understanding-check instruction


def test_system_prompt_is_deterministic_for_caching():
    plan = {"title": "T", "modules": [{"b": 1, "a": 2}]}
    kwargs = dict(level=LearningLevel.INTERMEDIATE, language="hi", interests=["Music"], topic="T")
    assert tutor_system_prompt(**kwargs, plan=plan) == tutor_system_prompt(
        **kwargs, plan=dict(reversed(list(plan.items())))
    )


# --- validation --------------------------------------------------------------


def test_validate_plan_clips_and_drops_empty_parts():
    plan = LessonPlan(
        title="  ML  ",
        overview="o",
        prerequisites=["", "algebra"],
        modules=[
            PlanModule(title="Empty", summary="", sections=[]),
            PlanModule(
                title="Basics",
                summary="s",
                sections=[PlanSection(title="Intro", objectives=["a"] * 10, key_terms=["t"])],
            ),
        ],
    )
    clean = validate_plan(plan)
    assert clean.title == "ML"
    assert [m.title for m in clean.modules] == ["Basics"]
    assert len(clean.modules[0].sections[0].objectives) == 6
    assert clean.prerequisites == ["algebra"]


def test_validate_plan_rejects_empty_plan():
    with pytest.raises(LLMError):
        validate_plan(LessonPlan(title="x", overview="", prerequisites=[], modules=[]))


# --- provider selection ------------------------------------------------------


@pytest.fixture
def fresh_factory():
    get_llm.cache_clear()
    yield
    get_llm.cache_clear()


def test_factory_uses_mock_without_key(fresh_factory, monkeypatch):
    monkeypatch.setattr(get_settings(), "llm_provider", "auto")
    monkeypatch.setattr(get_settings(), "anthropic_api_key", "")
    assert isinstance(get_llm(), MockLLMProvider)


def test_factory_uses_anthropic_with_key(fresh_factory, monkeypatch):
    monkeypatch.setattr(get_settings(), "llm_provider", "auto")
    monkeypatch.setattr(get_settings(), "anthropic_api_key", "sk-test")
    assert isinstance(get_llm(), AnthropicProvider)


def test_factory_refuses_forced_anthropic_without_key(fresh_factory, monkeypatch):
    monkeypatch.setattr(get_settings(), "llm_provider", "anthropic")
    monkeypatch.setattr(get_settings(), "anthropic_api_key", "")
    with pytest.raises(RuntimeError):
        get_llm()


# --- Claude adapter (fake SDK client, no network) ----------------------------


class FakeStream:
    def __init__(self, chunks, final):
        self.chunks, self.final = chunks, final

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    @property
    async def text_stream(self):
        for chunk in self.chunks:
            yield chunk

    async def get_final_message(self):
        return self.final


class FakeMessages:
    def __init__(self, *, chunks=(), stop_reason="end_turn", parsed=None, error=None):
        self.chunks, self.stop_reason, self.parsed, self.error = chunks, stop_reason, parsed, error
        self.kwargs: dict = {}

    def _final(self):
        usage = SimpleNamespace(input_tokens=11, output_tokens=7, cache_read_input_tokens=5)
        return SimpleNamespace(
            stop_reason=self.stop_reason,
            model="claude-opus-5-5",
            usage=usage,
            parsed_output=self.parsed,
        )

    def stream(self, **kwargs):
        self.kwargs = kwargs
        if self.error:
            raise self.error
        return FakeStream(self.chunks, self._final())

    async def parse(self, **kwargs):
        self.kwargs = kwargs
        if self.error:
            raise self.error
        return self._final()


def provider_with(messages: FakeMessages) -> AnthropicProvider:
    settings = Settings(anthropic_api_key="sk-test", llm_effort_tutor="low")
    return AnthropicProvider(
        settings, client=SimpleNamespace(beta=SimpleNamespace(messages=messages))
    )


async def collect(provider, **kwargs):
    return [e async for e in provider.stream_chat(**kwargs)]


async def test_stream_sends_expected_request_and_yields_deltas():
    fake = FakeMessages(chunks=["Hel", "lo"])
    provider = provider_with(fake)
    events = await collect(
        provider, system="SYS", messages=[ChatMessage("user", "Hi")], role="tutor"
    )

    assert events[:2] == [TextDelta("Hel"), TextDelta("lo")]
    done = events[-1]
    assert isinstance(done, StreamDone)
    assert done.usage.output_tokens == 7 and done.usage.cache_read_input_tokens == 5

    kw = fake.kwargs
    assert kw["model"] == "claude-opus-5-5"
    assert kw["messages"] == [{"role": "user", "content": "Hi"}]
    assert kw["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert kw["output_config"] == {"effort": "low"}
    assert kw["betas"] == [FALLBACK_BETA] and kw["fallbacks"] == "default"
    assert "temperature" not in kw and "thinking" not in kw


async def test_stream_refusal_raises():
    provider = provider_with(FakeMessages(chunks=["partial"], stop_reason="refusal"))
    with pytest.raises(LLMRefusal):
        await collect(provider, system="S", messages=[ChatMessage("user", "x")])


async def test_sdk_errors_become_safe_llm_errors():
    provider = provider_with(FakeMessages(error=RuntimeError("boom with internal details")))
    with pytest.raises(LLMError) as info:
        await collect(provider, system="S", messages=[ChatMessage("user", "x")])
    assert "internal details" not in info.value.user_message


async def test_parse_returns_validated_output_and_handles_truncation():
    plan = LessonPlan(title="t", overview="o", prerequisites=[], modules=[])
    fake = FakeMessages(parsed=plan)
    result = await provider_with(fake).parse(
        system="S", messages=[ChatMessage("user", "x")], schema=LessonPlan
    )
    assert result.value is plan
    assert fake.kwargs["output_format"] is LessonPlan
    assert fake.kwargs["output_config"] == {"effort": "medium"}

    with pytest.raises(LLMError):
        await provider_with(FakeMessages(parsed=None, stop_reason="max_tokens")).parse(
            system="S", messages=[ChatMessage("user", "x")], schema=LessonPlan
        )
