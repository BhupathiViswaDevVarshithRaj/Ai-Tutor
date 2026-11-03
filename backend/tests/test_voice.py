"""Voice tutor WebSocket: handshake, transcription, spoken turns, interruption, reconnection."""

import contextlib
import json
from array import array

import pytest
from httpx import AsyncClient
from httpx_ws import WebSocketDisconnect, WebSocketUpgradeError, aconnect_ws
from httpx_ws.transport import ASGIWebSocketTransport
from wsproto.events import BytesMessage, TextMessage

from app.ai.llm.factory import get_llm
from app.ai.llm.mock_provider import MockLLMProvider
from app.ai.speech.audio import encode_wav, sniff_container
from app.ai.speech.factory import get_tts
from app.ai.speech.gnani import GnaniTTSProvider
from app.ai.speech.mock import MOCK_TRANSCRIPT
from app.core.config import get_settings
from tests.conftest import API, register_user

pytestmark = pytest.mark.integration

WS_URL = f"{API}/voice/ws"
WAV = encode_wav(array("h", bytes(2 * 16 * 400)))


class RecordingLLM(MockLLMProvider):
    def __init__(self, delay_seconds: float = 0) -> None:
        super().__init__(delay_seconds=delay_seconds)
        self.systems: list[str] = []

    async def stream_chat(self, *, system, messages, role="tutor"):
        self.systems.append(system)
        async for event in super().stream_chat(system=system, messages=messages, role=role):
            yield event


@contextlib.asynccontextmanager
async def voice_client(app):
    """HTTP + WebSocket client for the app. Opened inside each test: the transport's task group
    must be entered and exited in the same task, which async fixtures don't guarantee."""
    async with AsyncClient(transport=ASGIWebSocketTransport(app), base_url="http://test") as client:
        yield client


@pytest.fixture
def voice_app(app, db):
    """The app, with a clean test database."""
    return app


@pytest.fixture
def llm(app):
    provider = RecordingLLM()
    app.dependency_overrides[get_llm] = lambda: provider
    return provider


async def voice_conversation(client, headers, **overrides) -> str:
    body = {"title": "Voice chat", "language": "hi", "level": "beginner", "mode": "voice"}
    resp = await client.post(f"{API}/conversations", headers=headers, json={**body, **overrides})
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def token_of(headers: dict) -> str:
    return headers["Authorization"].removeprefix("Bearer ")


async def frame(ws, timeout: float = 5):
    event = await ws.receive(timeout=timeout)
    if isinstance(event, TextMessage):
        return json.loads(event.data)
    assert isinstance(event, BytesMessage), event
    return bytes(event.data)


async def until(ws, kind: str) -> list:
    """Frames up to and including the first JSON frame of `kind`."""
    frames = []
    while True:
        f = await frame(ws)
        frames.append(f)
        if isinstance(f, dict) and f["type"] == kind:
            return frames


async def hello(ws, headers, conversation_id) -> dict:
    await ws.send_json(
        {"type": "hello", "token": token_of(headers), "conversation_id": conversation_id}
    )
    ready = await frame(ws)
    assert ready["type"] == "ready", ready
    return ready


async def test_handshake_returns_conversation_and_capabilities(voice_app, llm):
    async with voice_client(voice_app) as vclient:
        headers = await register_user(vclient)
        conv = await voice_conversation(vclient, headers)
        async with aconnect_ws(WS_URL, vclient) as ws:
            ready = await hello(ws, headers, conv)
        assert ready["conversation"]["id"] == conv
        assert ready["conversation"]["messages"] == []
        assert ready["ai"] == {"is_mock": True}
        assert ready["stt"] == {"available": True, "is_mock": True, "reason": None}
        assert ready["tts"]["available"] is True


async def test_spoken_turn_streams_text_and_audio_then_saves(voice_app, llm):
    async with voice_client(voice_app) as vclient:
        headers = await register_user(vclient)
        conv = await voice_conversation(vclient, headers)
        async with aconnect_ws(WS_URL, vclient) as ws:
            await hello(ws, headers, conv)
            await ws.send_json({"type": "say", "text": "What is gravity?", "input_mode": "voice"})
            frames = await until(ws, "speech_done")

        kinds = [f["type"] if isinstance(f, dict) else "<bytes>" for f in frames]
        assert kinds[0] == "turn_start" and kinds[-1] == "speech_done"
        assert "turn_done" in kinds and kinds.count("delta") > 3
        assert frames[0]["user_message"]["input_mode"] == "voice"
        assert frames[0]["turn"] == 1 and frames[0]["mock"] is True

        # Every audio header is immediately followed by its WAV bytes, in sequence order.
        audio = [
            (f, frames[i + 1])
            for i, f in enumerate(frames)
            if isinstance(f, dict) and f["type"] == "audio"
        ]
        assert len(audio) >= 2
        assert [h["seq"] for h, _ in audio] == list(range(len(audio)))
        for header, data in audio:
            assert isinstance(data, bytes) and sniff_container(data) == "wav"
            assert header["mime"] == "audio/wav" and header["duration_ms"] > 0
            assert "**" not in header["text"] and len(header["text"]) <= 400

        # The voice conversation uses the spoken reply style.
        assert "spoken conversation" in llm.systems[0]

        done = next(f for f in frames if isinstance(f, dict) and f["type"] == "turn_done")
        detail = (await vclient.get(f"{API}/conversations/{conv}", headers=headers)).json()
        assert [(m["role"], m["input_mode"]) for m in detail["messages"]] == [
            ("user", "voice"),
            ("assistant", "text"),
        ]
        assert detail["messages"][1]["content"] == done["message"]["content"]


async def test_text_conversations_keep_the_written_style(voice_app, llm):
    async with voice_client(voice_app) as vclient:
        headers = await register_user(vclient)
        conv = await voice_conversation(vclient, headers, mode="text")
        async with aconnect_ws(WS_URL, vclient) as ws:
            await hello(ws, headers, conv)
            await ws.send_json({"type": "say", "text": "Hello"})
            await until(ws, "speech_done")
        assert "Use Markdown" in llm.systems[0]


async def test_recording_is_transcribed(voice_app, llm):
    async with voice_client(voice_app) as vclient:
        headers = await register_user(vclient)
        conv = await voice_conversation(vclient, headers)
        async with aconnect_ws(WS_URL, vclient) as ws:
            await hello(ws, headers, conv)
            await ws.send_json({"type": "audio", "mime": "audio/wav"})
            await ws.send_bytes(WAV)
            transcript = await frame(ws)
        assert transcript == {
            "type": "transcript",
            "text": MOCK_TRANSCRIPT,
            "language": "hi",
            "duration_ms": 400,
            "is_mock": True,
        }


async def test_bad_frames_get_errors_without_closing(voice_app, llm):
    async with voice_client(voice_app) as vclient:
        headers = await register_user(vclient)
        conv = await voice_conversation(vclient, headers)
        async with aconnect_ws(WS_URL, vclient) as ws:
            await hello(ws, headers, conv)
            await ws.send_bytes(WAV)
            assert (await frame(ws))["code"] == "unexpected_audio"
            await ws.send_json({"type": "audio", "mime": "audio/webm"})
            await ws.send_bytes(WAV)
            assert (await frame(ws))["code"] == "unsupported_audio"
            await ws.send_text("not json")
            assert (await frame(ws))["code"] == "bad_message"
            await ws.send_json({"type": "say", "text": "   "})
            assert (await frame(ws))["code"] == "bad_message"
            await ws.send_json({"type": "dance"})
            assert (await frame(ws))["code"] == "unknown_type"
            await ws.send_json({"type": "ping"})
            assert await frame(ws) == {"type": "pong"}


async def test_interrupt_stops_the_reply_and_saves_nothing(voice_app, app):
    async with voice_client(voice_app) as vclient:
        app.dependency_overrides[get_llm] = lambda: MockLLMProvider(delay_seconds=0.05)
        headers = await register_user(vclient)
        conv = await voice_conversation(vclient, headers)
        async with aconnect_ws(WS_URL, vclient) as ws:
            await hello(ws, headers, conv)
            await ws.send_json({"type": "say", "text": "Tell me a long story"})
            assert (await frame(ws))["type"] == "turn_start"
            assert (await frame(ws))["type"] == "delta"
            await ws.send_json({"type": "interrupt"})
            frames = await until(ws, "interrupted")
            assert frames[-1] == {"type": "interrupted", "turn": 1}
            assert not any(isinstance(f, dict) and f["type"] == "turn_done" for f in frames)

        detail = (await vclient.get(f"{API}/conversations/{conv}", headers=headers)).json()
        assert [m["role"] for m in detail["messages"]] == ["user"]


async def test_a_new_question_interrupts_the_current_reply(voice_app, app):
    async with voice_client(voice_app) as vclient:
        app.dependency_overrides[get_llm] = lambda: MockLLMProvider(delay_seconds=0.05)
        headers = await register_user(vclient)
        conv = await voice_conversation(vclient, headers)
        async with aconnect_ws(WS_URL, vclient) as ws:
            await hello(ws, headers, conv)
            await ws.send_json({"type": "say", "text": "First question"})
            assert (await frame(ws))["type"] == "turn_start"
            await ws.send_json({"type": "say", "text": "Actually, second question"})
            frames = await until(ws, "speech_done")

        turns = {(f["type"], f.get("turn")) for f in frames if isinstance(f, dict)}
        assert (
            ("interrupted", 1) in turns
            and ("turn_done", 2) in turns
            and ("speech_done", 2) in turns
        )
        detail = (await vclient.get(f"{API}/conversations/{conv}", headers=headers)).json()
        assert [(m["role"], m["content"]) for m in detail["messages"]][:2] == [
            ("user", "First question"),
            ("user", "Actually, second question"),
        ]
        assert detail["messages"][-1]["role"] == "assistant"


async def test_reconnecting_restores_history(voice_app, llm):
    async with voice_client(voice_app) as vclient:
        headers = await register_user(vclient)
        conv = await voice_conversation(vclient, headers)
        async with aconnect_ws(WS_URL, vclient) as ws:
            await hello(ws, headers, conv)
            await ws.send_json({"type": "say", "text": "Remember me"})
            await until(ws, "speech_done")
        async with aconnect_ws(WS_URL, vclient) as ws:
            ready = await hello(ws, headers, conv)
        assert [m["role"] for m in ready["conversation"]["messages"]] == ["user", "assistant"]
        assert ready["conversation"]["messages"][0]["content"] == "Remember me"


@pytest.mark.parametrize(
    ("message", "code"),
    [
        ({"type": "hello", "token": "not-a-jwt", "conversation_id": "x"}, 4401),
        ({"type": "nope"}, 4400),
    ],
)
async def test_handshake_rejections(voice_app, llm, message, code):
    async with voice_client(voice_app) as vclient:
        async with aconnect_ws(WS_URL, vclient) as ws:
            await ws.send_json(message)
            with pytest.raises(WebSocketDisconnect) as exc:
                await frame(ws)
        assert exc.value.code == code


async def test_other_users_conversation_is_not_found(voice_app, llm):
    async with voice_client(voice_app) as vclient:
        owner = await register_user(vclient, email="owner@example.com")
        conv = await voice_conversation(vclient, owner)
        other = await register_user(vclient, email="other@example.com")
        async with aconnect_ws(WS_URL, vclient) as ws:
            await ws.send_json({"type": "hello", "token": token_of(other), "conversation_id": conv})
            with pytest.raises(WebSocketDisconnect) as exc:
                await frame(ws)
        assert exc.value.code == 4404


async def test_foreign_origin_is_refused(voice_app, llm):
    async with voice_client(voice_app) as vclient:
        # Closed before accept: a real server answers HTTP 403; the test transport reports the
        # close code (possibly inside an exception group).
        with pytest.raises((WebSocketUpgradeError, WebSocketDisconnect, ExceptionGroup)) as exc:
            async with aconnect_ws(WS_URL, vclient, headers={"Origin": "https://evil.example"}):
                pass
        assert isinstance(exc.value, WebSocketUpgradeError) or "4403" in repr(
            exc.value.exceptions if isinstance(exc.value, ExceptionGroup) else exc.value
        )


async def test_turns_are_rate_limited(voice_app, llm, monkeypatch):
    async with voice_client(voice_app) as vclient:
        monkeypatch.setattr(get_settings(), "ai_rate_limit", 1)
        headers = await register_user(vclient)
        conv = await voice_conversation(vclient, headers)
        async with aconnect_ws(WS_URL, vclient) as ws:
            await hello(ws, headers, conv)
            await ws.send_json({"type": "say", "text": "One"})
            await until(ws, "speech_done")
            await ws.send_json({"type": "say", "text": "Two"})
            error = await frame(ws)
        assert error["code"] == "rate_limited" and error["retryable"] is True


async def test_conversation_continues_without_audio_when_tts_is_unavailable(voice_app, app, llm):
    async with voice_client(voice_app) as vclient:
        app.dependency_overrides[get_tts] = lambda: GnaniTTSProvider(get_settings())
        headers = await register_user(vclient)
        conv = await voice_conversation(vclient, headers)
        async with aconnect_ws(WS_URL, vclient) as ws:
            ready = await hello(ws, headers, conv)
            assert ready["tts"] == {
                "available": False,
                "is_mock": False,
                "reason": "Read-aloud is not available right now.",
            }
            await ws.send_json({"type": "say", "text": "Hello"})
            frames = await until(ws, "speech_done")
        assert any(isinstance(f, dict) and f["type"] == "turn_done" for f in frames)
        assert not any(isinstance(f, bytes) or f["type"] == "audio" for f in frames)


async def test_voice_conversations_can_be_listed(voice_app, llm):
    async with voice_client(voice_app) as vclient:
        headers = await register_user(vclient)
        voice = await voice_conversation(vclient, headers)
        await voice_conversation(vclient, headers, mode="text")
        resp = await vclient.get(f"{API}/conversations", headers=headers, params={"mode": "voice"})
        assert [c["id"] for c in resp.json()["items"]] == [voice]
