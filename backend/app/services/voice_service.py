"""Voice tutor sessions over a WebSocket: speak → transcript → streamed reply → spoken reply.

Protocol (JSON text frames unless noted; see ARCHITECTURE.md › Voice tutor):

client → server
  hello      {token, conversation_id}           first frame, within HELLO_TIMEOUT
  audio      {mime}                             followed by ONE binary frame with the recording
  say        {text, input_mode?, voice?}        start a tutor turn (interrupts a running one)
  interrupt  {}                                 stop the current reply and its speech
  ping       {}

server → client
  ready        {conversation (with messages), ai, stt, tts}
  transcript   {text, language, duration_ms, is_mock}
  turn_start   {turn, user_message, mock}
  delta        {turn, text}
  audio        {turn, seq, text, mime, duration_ms, voice}  followed by ONE binary frame
  turn_done    {turn, message, truncated}       the reply is saved
  speech_done  {turn}                           no more audio for this turn
  interrupted  {turn}
  error        {code, message, retryable, turn?}
  pong         {}

Close codes: 4400 protocol error, 4401 not authenticated, 4403 origin not allowed,
4404 conversation not found.
"""

import asyncio
import contextlib
import json
import logging
import uuid

import jwt
from fastapi import WebSocket
from fastapi.websockets import WebSocketDisconnect

from app.ai.llm.base import LLMProvider
from app.ai.speech.audio import base_mime
from app.ai.speech.base import ProviderNotConfigured, SpeechError, STTProvider, TTSProvider
from app.ai.speech.sentences import SentenceBuffer
from app.core.config import Settings
from app.core.errors import AppError
from app.core.rate_limit import check_rate_limit
from app.core.security import decode_access_token
from app.db.enums import InputMode
from app.db.models import User
from app.db.session import session_scope
from app.schemas.learning import ConversationDetail
from app.schemas.tutor import TutorMessageIn
from app.services import learning_service, tutor_service
from app.services.speech_service import validate_audio

logger = logging.getLogger(__name__)

HELLO_TIMEOUT_SECONDS = 10
MAX_TEXT_CHARS = 8000

CLOSE_PROTOCOL = 4400
CLOSE_UNAUTHENTICATED = 4401
CLOSE_FORBIDDEN_ORIGIN = 4403
CLOSE_NOT_FOUND = 4404


class VoiceSession:
    def __init__(
        self,
        websocket: WebSocket,
        *,
        llm: LLMProvider,
        stt: STTProvider,
        tts: TTSProvider,
        settings: Settings,
    ) -> None:
        self.ws = websocket
        self.llm = llm
        self.stt = stt
        self.tts = tts
        self.settings = settings
        self.user_id: uuid.UUID | None = None
        self.conversation_id: uuid.UUID | None = None
        self.language = "en"
        self.turn = 0
        self.turn_task: asyncio.Task | None = None
        self.stt_task: asyncio.Task | None = None
        self.pending_audio_mime: str | None = None
        self.closed = False
        self._send_lock = asyncio.Lock()

    # --- lifecycle ---------------------------------------------------------------

    async def run(self) -> None:
        origin = self.ws.headers.get("origin")
        if origin and origin not in self.settings.cors_origins:
            await self.ws.close(code=CLOSE_FORBIDDEN_ORIGIN)
            return
        await self.ws.accept()
        try:
            if await self._handshake():
                await self._receive_loop()
        except WebSocketDisconnect:
            pass
        finally:
            self.closed = True
            for task in (self.turn_task, self.stt_task):
                if task and not task.done():
                    task.cancel()
                    with contextlib.suppress(asyncio.CancelledError):
                        await task

    async def _handshake(self) -> bool:
        try:
            hello = json.loads(
                await asyncio.wait_for(self.ws.receive_text(), HELLO_TIMEOUT_SECONDS)
            )
        except (TimeoutError, ValueError, KeyError):
            return await self._close(CLOSE_PROTOCOL, "Expected a hello message.")
        if not isinstance(hello, dict) or hello.get("type") != "hello":
            return await self._close(CLOSE_PROTOCOL, "Expected a hello message.")
        try:
            user_id = decode_access_token(str(hello.get("token", "")))
        except (jwt.InvalidTokenError, ValueError):
            return await self._close(CLOSE_UNAUTHENTICATED, "Session expired. Sign in again.")
        try:
            conversation_id = uuid.UUID(str(hello.get("conversation_id", "")))
        except ValueError:
            return await self._close(CLOSE_NOT_FOUND, "Conversation not found.")

        async with session_scope() as session:
            user = await session.get(User, user_id)
            if user is None or not user.is_active:
                return await self._close(CLOSE_UNAUTHENTICATED, "Session expired. Sign in again.")
            try:
                conversation = await learning_service.get_conversation(
                    session, user.id, conversation_id, with_messages=True
                )
            except AppError:
                return await self._close(CLOSE_NOT_FOUND, "Conversation not found.")
            detail = ConversationDetail.model_validate(conversation).model_dump(mode="json")

        self.user_id, self.conversation_id = user_id, conversation_id
        self.language = detail["language"]
        await self._send(
            {
                "type": "ready",
                "conversation": detail,
                "ai": {"is_mock": self.llm.is_mock},
                "stt": self._capability(self.stt, "Voice input"),
                "tts": self._capability(self.tts, "Read-aloud"),
            }
        )
        return True

    def _capability(self, provider: STTProvider | TTSProvider, what: str) -> dict:
        reason = provider.unavailable_reason and f"{what} is not available right now."
        if reason is None and self.language not in provider.supported_languages():
            reason = f"{what} doesn't support this conversation's language yet."
        return {"available": reason is None, "is_mock": provider.is_mock, "reason": reason}

    async def _close(self, code: int, reason: str) -> bool:
        self.closed = True
        with contextlib.suppress(RuntimeError):
            await self.ws.close(code=code, reason=reason)
        return False

    # --- receiving ---------------------------------------------------------------

    async def _receive_loop(self) -> None:
        while True:
            message = await self.ws.receive()
            if message["type"] == "websocket.disconnect":
                return
            if message.get("bytes") is not None:
                await self._on_audio_bytes(message["bytes"])
                continue
            try:
                data = json.loads(message.get("text") or "")
                kind = data["type"]
            except (ValueError, TypeError, KeyError):
                await self._error("bad_message", "Messages must be JSON with a type.")
                continue
            if kind == "ping":
                await self._send({"type": "pong"})
            elif kind == "audio":
                self.pending_audio_mime = base_mime(data.get("mime"))
            elif kind == "say":
                await self._on_say(data)
            elif kind == "interrupt":
                await self._interrupt()
            else:
                await self._error("unknown_type", f"Unknown message type: {kind}")

    async def _on_audio_bytes(self, audio: bytes) -> None:
        mime, self.pending_audio_mime = self.pending_audio_mime, None
        if mime is None:
            await self._error("unexpected_audio", "Send an audio message before the recording.")
        elif self.stt_task and not self.stt_task.done():
            await self._error("busy", "Still transcribing the previous recording.")
        else:
            self.stt_task = asyncio.create_task(self._transcribe(audio, mime))

    async def _on_say(self, data: dict) -> None:
        text = data.get("text")
        text = text.strip() if isinstance(text, str) else ""
        input_mode = data.get("input_mode", "text")
        voice = data.get("voice")
        if not text or len(text) > MAX_TEXT_CHARS:
            await self._error("bad_message", f"Say something (up to {MAX_TEXT_CHARS} characters).")
            return
        if input_mode not in ("text", "voice") or not (
            voice is None or (isinstance(voice, str) and len(voice) <= 100)
        ):
            await self._error("bad_message", "Invalid input mode or voice.")
            return
        try:
            await check_rate_limit(
                "ai", f"user:{self.user_id}", "ai_rate_limit", "ai_rate_window_seconds"
            )
        except AppError as exc:
            await self._error(exc.code, exc.message, retryable=True)
            return
        await self._interrupt()  # barge-in: a new question replaces the current reply
        self.turn += 1
        self.turn_task = asyncio.create_task(
            self._run_turn(self.turn, text, InputMode(input_mode), voice)
        )

    async def _interrupt(self) -> None:
        task, self.turn_task = self.turn_task, None
        if task and not task.done():
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
            await self._send({"type": "interrupted", "turn": self.turn})

    # --- work --------------------------------------------------------------------

    async def _transcribe(self, audio: bytes, mime: str) -> None:
        try:
            await check_rate_limit(
                "speech", f"user:{self.user_id}", "speech_rate_limit", "speech_rate_window_seconds"
            )
            if self.stt.unavailable_reason is not None:
                raise ProviderNotConfigured("Voice input is not available right now.")
            validate_audio(audio, mime, self.settings)
            transcript = await self.stt.transcribe(audio, mime_type=mime, language=self.language)
        except AppError as exc:
            await self._error(exc.code, exc.message, retryable=exc.status_code == 429)
            return
        except SpeechError as exc:
            await self._error("speech_unavailable", exc.user_message, retryable=exc.retryable)
            return
        await self._send(
            {
                "type": "transcript",
                "text": transcript.text,
                "language": transcript.language,
                "duration_ms": transcript.duration_ms,
                "is_mock": self.stt.is_mock,
            }
        )

    async def _run_turn(self, turn: int, text: str, input_mode: InputMode, voice: str | None):
        speaker: asyncio.Task | None = None
        try:
            async with session_scope() as session:
                user = await session.get(User, self.user_id)
                if user is None or not user.is_active:
                    await self._error("not_authenticated", "Session expired. Sign in again.")
                    return
                prepared = await tutor_service.prepare_turn(
                    session,
                    user,
                    self.conversation_id,
                    TutorMessageIn(content=text, input_mode=input_mode),
                )
            queue: asyncio.Queue[str | None] = asyncio.Queue()
            speaker = asyncio.create_task(self._speak(turn, queue, voice))
            sentences = SentenceBuffer(max_chars=min(400, self.settings.speech_max_tts_chars))
            failed = False
            async for event, data in tutor_service.turn_events(self.llm, prepared):
                if event == "start":
                    await self._send({"type": "turn_start", "turn": turn, **data})
                elif event == "delta":
                    await self._send({"type": "delta", "turn": turn, **data})
                    for sentence in sentences.feed(data["text"]):
                        queue.put_nowait(sentence)
                elif event == "done":
                    for sentence in sentences.flush():
                        queue.put_nowait(sentence)
                    await self._send({"type": "turn_done", "turn": turn, **data})
                else:
                    failed = True
                    await self._error("ai_unavailable", data["message"], data["retryable"], turn)
            if failed:
                speaker.cancel()
            queue.put_nowait(None)
            with contextlib.suppress(asyncio.CancelledError):
                await speaker
            await self._send({"type": "speech_done", "turn": turn})
        except asyncio.CancelledError:
            if speaker:
                speaker.cancel()
            raise
        except AppError as exc:
            await self._error(exc.code, exc.message, False, turn)
        except Exception:
            logger.exception("voice turn failed")
            await self._error(
                "internal_error", "Something went wrong. Please try again.", True, turn
            )

    async def _speak(self, turn: int, queue: asyncio.Queue[str | None], voice: str | None):
        """Synthesize queued sentences in order and send each as an audio frame."""
        muted = not self._capability(self.tts, "Read-aloud")["available"]
        seq = 0
        while (sentence := await queue.get()) is not None:
            if muted:
                continue
            try:
                result = await self.tts.synthesize(sentence, language=self.language, voice=voice)
            except SpeechError as exc:
                muted = True  # keep the text conversation going without audio
                await self._error("speech_failed", exc.user_message, False, turn)
                continue
            header = {
                "type": "audio",
                "turn": turn,
                "seq": seq,
                "text": sentence,
                "mime": result.mime_type,
                "duration_ms": result.duration_ms,
                "voice": result.voice,
            }
            async with self._send_lock:
                if self.closed:
                    return
                try:
                    await self.ws.send_text(json.dumps(header, ensure_ascii=False))
                    await self.ws.send_bytes(result.audio)
                except (WebSocketDisconnect, RuntimeError):
                    self.closed = True
                    return
            seq += 1

    # --- sending -----------------------------------------------------------------

    async def _send(self, data: dict) -> None:
        async with self._send_lock:
            if self.closed:
                return
            try:
                await self.ws.send_text(json.dumps(data, ensure_ascii=False))
            except (WebSocketDisconnect, RuntimeError):
                self.closed = True

    async def _error(
        self, code: str, message: str, retryable: bool = False, turn: int | None = None
    ) -> None:
        payload = {"type": "error", "code": code, "message": message, "retryable": retryable}
        if turn is not None:
            payload["turn"] = turn
        await self._send(payload)
