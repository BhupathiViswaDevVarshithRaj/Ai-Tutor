import json

import pytest

from app.ai.llm.base import LLMRefusal, TextDelta
from app.ai.llm.factory import get_llm
from app.ai.llm.mock_provider import MockLLMProvider
from app.core.config import get_settings
from tests.conftest import API, register_user

pytestmark = pytest.mark.integration

LESSON = {"topic": "Photosynthesis", "level": "beginner", "language": "hi"}


def parse_sse(body: str) -> list[tuple[str, dict]]:
    events = []
    for block in body.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines() if ": " in line)
        events.append((lines["event"], json.loads(lines["data"])))
    return events


class RecordingLLM(MockLLMProvider):
    """Mock that records every stream call so tests can inspect the model context."""

    def __init__(self) -> None:
        super().__init__(delay_seconds=0)
        self.calls: list[tuple[str, list]] = []

    async def stream_chat(self, *, system, messages, role="tutor"):
        self.calls.append((system, list(messages)))
        async for event in super().stream_chat(system=system, messages=messages, role=role):
            yield event


class RefusingLLM(MockLLMProvider):
    async def stream_chat(self, *, system, messages, role="tutor"):
        yield TextDelta("partial answer ")
        raise LLMRefusal()

    async def parse(self, *, system, messages, schema, role="structured"):
        raise LLMRefusal()


@pytest.fixture
def llm(app):
    provider = RecordingLLM()
    app.dependency_overrides[get_llm] = lambda: provider
    return provider


async def start_lesson(api, headers, payload=LESSON) -> dict:
    resp = await api.post(f"{API}/tutor/lessons", headers=headers, json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def reply(api, headers, conversation_id, content: str):
    return await api.post(
        f"{API}/tutor/conversations/{conversation_id}/reply",
        headers=headers,
        json={"content": content},
    )


async def test_info_reports_mock_provider(api):
    headers = await register_user(api)
    info = (await api.get(f"{API}/tutor/info", headers=headers)).json()
    assert info == {
        "provider": "mock",
        "is_mock": True,
        "tutor_model": "mock-tutor",
        "structured_model": "mock-tutor",
    }
    assert (await api.get(f"{API}/tutor/info")).status_code == 401


async def test_start_lesson_creates_plan_and_conversation(api):
    headers = await register_user(api)
    data = await start_lesson(api, headers)

    lesson, conversation = data["lesson"], data["conversation"]
    assert lesson["topic"] == "Photosynthesis"
    assert lesson["language"] == "hi" and lesson["level"] == "beginner"
    assert lesson["plan"]["modules"][0]["sections"][0]["title"] == "What is Photosynthesis?"
    assert conversation["lesson_id"] == lesson["id"]
    assert conversation["title"] == lesson["plan"]["title"]

    listed = (await api.get(f"{API}/lessons", headers=headers)).json()
    assert listed["total"] == 1


async def test_start_lesson_validation(api):
    headers = await register_user(api)
    for bad in ({**LESSON, "topic": "x"}, {**LESSON, "language": "fr"}, {**LESSON, "level": "pro"}):
        assert (
            await api.post(f"{API}/tutor/lessons", headers=headers, json=bad)
        ).status_code == 422


async def test_reply_streams_and_persists_both_messages(api, llm):
    headers = await register_user(api)
    conv_id = (await start_lesson(api, headers))["conversation"]["id"]

    resp = await reply(api, headers, conv_id, "What is chlorophyll?")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/event-stream")
    events = parse_sse(resp.text)

    names = [name for name, _ in events]
    assert names[0] == "start" and names[-1] == "done"
    assert names.count("delta") > 3
    streamed = "".join(d["text"] for name, d in events if name == "delta").strip()
    assert events[0][1]["user_message"]["content"] == "What is chlorophyll?"
    assert events[0][1]["mock"] is True
    done = events[-1][1]["message"]
    assert done["role"] == "assistant" and done["content"] == streamed

    detail = (await api.get(f"{API}/conversations/{conv_id}", headers=headers)).json()
    assert [(m["role"], m["content"]) for m in detail["messages"]] == [
        ("user", "What is chlorophyll?"),
        ("assistant", streamed),
    ]


async def test_reply_records_how_the_learner_asked(api, llm):
    headers = await register_user(api)
    conv_id = (await start_lesson(api, headers))["conversation"]["id"]

    resp = await api.post(
        f"{API}/tutor/conversations/{conv_id}/reply",
        headers=headers,
        json={"content": "How do plants breathe?", "input_mode": "voice"},
    )
    assert parse_sse(resp.text)[0][1]["user_message"]["input_mode"] == "voice"
    await reply(api, headers, conv_id, "And at night?")

    detail = (await api.get(f"{API}/conversations/{conv_id}", headers=headers)).json()
    user_modes = [m["input_mode"] for m in detail["messages"] if m["role"] == "user"]
    assert user_modes == ["voice", "text"]


async def test_reply_uses_conversation_memory_and_lesson_context(api, llm):
    headers = await register_user(api)
    await api.patch(f"{API}/users/me/preferences", headers=headers, json={"interests": ["Cricket"]})
    conv_id = (await start_lesson(api, headers))["conversation"]["id"]

    await reply(api, headers, conv_id, "First question")
    await reply(api, headers, conv_id, "Second question")

    system, messages = llm.calls[-1]
    assert [m.role for m in messages] == ["user", "assistant", "user"]
    assert messages[0].content == "First question"
    assert messages[-1].content == "Second question"
    assert "BEGINNER" in system
    assert "Hindi" in system
    assert "Topic: Photosynthesis" in system
    assert "What is Photosynthesis?" in system  # the plan is in context
    assert "Cricket" in system
    # Stable across turns, so the prompt prefix can be cached.
    assert llm.calls[0][0] == system


async def test_memory_window_is_bounded(api, llm, monkeypatch):
    monkeypatch.setattr(get_settings(), "llm_history_messages", 2)
    headers = await register_user(api)
    conv_id = (await start_lesson(api, headers))["conversation"]["id"]
    for i in range(3):
        await reply(api, headers, conv_id, f"q{i}")
    _, messages = llm.calls[-1]
    # 2 most recent stored messages (q1, its answer) + the new question.
    assert [m.content for m in messages][0] == "q1"
    assert len(messages) == 3


async def test_refusal_is_reported_and_partial_reply_discarded(api, app):
    app.dependency_overrides[get_llm] = lambda: RefusingLLM()
    headers = await register_user(api)
    conv = await api.post(
        f"{API}/conversations",
        headers=headers,
        json={"title": "Free chat", "language": "en", "level": "beginner"},
    )
    conv_id = conv.json()["id"]

    events = parse_sse((await reply(api, headers, conv_id, "Something odd")).text)
    assert events[-1][0] == "error"
    assert events[-1][1]["retryable"] is False
    detail = (await api.get(f"{API}/conversations/{conv_id}", headers=headers)).json()
    assert [m["role"] for m in detail["messages"]] == ["user"]

    refused = await api.post(f"{API}/tutor/lessons", headers=headers, json=LESSON)
    assert refused.status_code == 422
    assert refused.json()["code"] == "ai_refused"


async def test_summary(api):
    headers = await register_user(api)
    data = await start_lesson(api, headers)
    lesson_id, conv_id = data["lesson"]["id"], data["conversation"]["id"]

    early = await api.post(f"{API}/tutor/lessons/{lesson_id}/summary", headers=headers)
    assert early.status_code == 400
    assert early.json()["code"] == "nothing_to_summarize"

    await reply(api, headers, conv_id, "Explain photosynthesis")
    resp = await api.post(f"{API}/tutor/lessons/{lesson_id}/summary", headers=headers)
    assert resp.status_code == 200
    assert "Mock summary" in resp.json()["summary"]
    assert "**Key points**" in resp.json()["summary"]


async def test_tutor_routes_respect_ownership(api):
    alice = await register_user(api, email="alice@example.com")
    bob = await register_user(api, email="bob@example.com")
    data = await start_lesson(api, alice)

    hijack = await reply(api, bob, data["conversation"]["id"], "hi")
    assert hijack.status_code == 404
    summary = await api.post(f"{API}/tutor/lessons/{data['lesson']['id']}/summary", headers=bob)
    assert summary.status_code == 404
    detail = await api.get(f"{API}/conversations/{data['conversation']['id']}", headers=alice)
    assert detail.json()["messages"] == []


async def test_ai_endpoints_are_rate_limited(api, monkeypatch):
    monkeypatch.setattr(get_settings(), "ai_rate_limit", 2)
    headers = await register_user(api)
    codes = [
        (await api.post(f"{API}/tutor/lessons", headers=headers, json=LESSON)).status_code
        for _ in range(3)
    ]
    assert codes == [201, 201, 429]


async def test_lesson_progress_can_be_tracked(api):
    headers = await register_user(api)
    lesson_id = (await start_lesson(api, headers))["lesson"]["id"]
    resp = await api.patch(
        f"{API}/lessons/{lesson_id}",
        headers=headers,
        json={"current_section": 1, "completed_sections": [0]},
    )
    assert resp.json()["current_section"] == 1
    assert resp.json()["completed_sections"] == [0]
