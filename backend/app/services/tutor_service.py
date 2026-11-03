"""AI tutor: lesson plans, streamed replies with conversation memory, and summaries."""

import json
import logging
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm.base import ChatMessage, LLMError, LLMProvider, StreamDone, TextDelta
from app.ai.prompts import (
    PLANNER_SYSTEM,
    SUMMARY_SYSTEM,
    plan_request,
    summary_request,
    tutor_system_prompt,
)
from app.ai.schemas import LessonPlan, LessonSummary, validate_plan, validate_summary
from app.core.config import get_settings
from app.core.errors import AppError
from app.db.enums import ConversationMode, MessageRole
from app.db.models import Conversation, Lesson, Message, User
from app.db.session import session_scope
from app.schemas.learning import MessageOut
from app.schemas.tutor import LessonGenerate, TutorMessageIn
from app.services.learning_service import get_conversation, get_lesson

logger = logging.getLogger(__name__)

# Keep the summary transcript bounded; the most recent part matters most.
MAX_TRANSCRIPT_CHARS = 40_000


async def generate_lesson(
    session: AsyncSession, llm: LLMProvider, user: User, data: LessonGenerate
) -> tuple[Lesson, Conversation]:
    """Ask the model for a validated lesson plan, then create the lesson and its conversation."""
    result = await llm.parse(
        system=PLANNER_SYSTEM,
        messages=[
            ChatMessage(
                "user",
                plan_request(
                    topic=data.topic,
                    level=data.level,
                    language=data.language,
                    interests=user.preferences.interests,
                ),
            )
        ],
        schema=LessonPlan,
    )
    plan = validate_plan(result.value)
    logger.info(
        "lesson plan generated model=%s in=%s out=%s",
        result.model,
        result.usage.input_tokens,
        result.usage.output_tokens,
    )

    lesson = Lesson(
        user_id=user.id,
        topic=data.topic,
        level=data.level,
        language=data.language,
        plan=plan.model_dump(),
    )
    session.add(lesson)
    await session.flush()
    conversation = Conversation(
        user_id=user.id,
        lesson_id=lesson.id,
        title=plan.title,
        language=data.language,
        level=data.level,
    )
    session.add(conversation)
    await session.commit()
    await session.refresh(lesson)
    await session.refresh(conversation)
    return lesson, conversation


@dataclass
class PreparedTurn:
    conversation_id: uuid.UUID
    user_id: uuid.UUID
    language: str
    user_message: Message
    system: str
    history: list[ChatMessage]


async def prepare_turn(
    session: AsyncSession, user: User, conversation_id: uuid.UUID, data: TutorMessageIn
) -> PreparedTurn:
    """Check ownership, store the learner's message and assemble the model context."""
    conversation = await get_conversation(session, user.id, conversation_id, with_messages=False)
    lesson = await session.get(Lesson, conversation.lesson_id) if conversation.lesson_id else None

    recent = await session.scalars(
        select(Message)
        .where(
            Message.conversation_id == conversation.id,
            Message.role.in_([MessageRole.USER, MessageRole.ASSISTANT]),
        )
        .order_by(Message.created_at.desc())
        .limit(get_settings().llm_history_messages)
    )
    history = [ChatMessage(m.role.value, m.content) for m in reversed(list(recent))]

    user_message = Message(
        conversation_id=conversation.id,
        user_id=user.id,
        role=MessageRole.USER,
        content=data.content,
        language=conversation.language,
        input_mode=data.input_mode,
    )
    session.add(user_message)
    conversation.updated_at = func.now()
    await session.commit()
    await session.refresh(user_message)

    history.append(ChatMessage("user", data.content))
    while history and history[0].role != "user":  # the API requires a user turn first
        history.pop(0)

    system = tutor_system_prompt(
        level=conversation.level,
        language=conversation.language,
        interests=user.preferences.interests,
        topic=lesson.topic if lesson else None,
        plan=lesson.plan if lesson else None,
        spoken=conversation.mode == ConversationMode.VOICE,
    )
    return PreparedTurn(
        conversation_id=conversation.id,
        user_id=user.id,
        language=conversation.language,
        user_message=user_message,
        system=system,
        history=history,
    )


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _message_json(message: Message) -> dict:
    return MessageOut.model_validate(message).model_dump(mode="json")


async def stream_turn(llm: LLMProvider, turn: PreparedTurn) -> AsyncIterator[str]:
    """Server-sent events: start → delta* → done | error. The reply is saved when complete."""
    async for event, data in turn_events(llm, turn):
        yield sse(event, data)


async def turn_events(llm: LLMProvider, turn: PreparedTurn) -> AsyncIterator[tuple[str, dict]]:
    """Events of one tutor turn: start → delta* → done | error (SSE and voice share this).

    The reply is saved only when complete; if the consumer stops early (e.g. the learner
    interrupts), nothing is saved.
    """
    yield "start", {"user_message": _message_json(turn.user_message), "mock": llm.is_mock}

    parts: list[str] = []
    done: StreamDone | None = None
    try:
        async for event in llm.stream_chat(system=turn.system, messages=turn.history):
            if isinstance(event, TextDelta):
                parts.append(event.text)
                yield "delta", {"text": event.text}
            else:
                done = event
    except LLMError as exc:
        # A partial reply (e.g. declined mid-stream) is discarded, not saved.
        yield "error", {"message": exc.user_message, "retryable": exc.retryable}
        return

    text = "".join(parts).strip()
    if done is None or not text:
        yield "error", {"message": "The tutor didn't reply. Please try again.", "retryable": True}
        return

    async with session_scope() as session:
        reply = Message(
            conversation_id=turn.conversation_id,
            user_id=turn.user_id,
            role=MessageRole.ASSISTANT,
            content=text,
            language=turn.language,
            model=done.model,
            input_tokens=done.usage.input_tokens,
            output_tokens=done.usage.output_tokens,
            meta={
                "stop_reason": done.stop_reason,
                "cache_read_input_tokens": done.usage.cache_read_input_tokens,
            },
        )
        session.add(reply)
        await session.execute(
            update(Conversation)
            .where(Conversation.id == turn.conversation_id)
            .values(updated_at=func.now())
        )
        await session.commit()
        await session.refresh(reply)
    yield "done", {"message": _message_json(reply), "truncated": done.stop_reason == "max_tokens"}


def _summary_markdown(summary: LessonSummary) -> str:
    parts = [summary.summary]
    if summary.key_points:
        parts.append("**Key points**\n" + "\n".join(f"- {p}" for p in summary.key_points))
    if summary.next_steps:
        parts.append("**Next steps**\n" + "\n".join(f"- {s}" for s in summary.next_steps))
    return "\n\n".join(parts)


async def summarize_lesson(
    session: AsyncSession, llm: LLMProvider, user: User, lesson_id: uuid.UUID
) -> Lesson:
    lesson = await get_lesson(session, user.id, lesson_id)
    rows = await session.scalars(
        select(Message)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(
            Conversation.lesson_id == lesson.id,
            Message.user_id == user.id,
            Message.role.in_([MessageRole.USER, MessageRole.ASSISTANT]),
        )
        .order_by(Message.created_at)
    )
    messages = list(rows)
    if not any(m.role == MessageRole.USER for m in messages):
        raise AppError(
            400, "nothing_to_summarize", "Chat with your tutor first, then ask for a summary."
        )
    transcript = "\n".join(
        f"{'Learner' if m.role == MessageRole.USER else 'Tutor'}: {m.content}" for m in messages
    )[-MAX_TRANSCRIPT_CHARS:]

    result = await llm.parse(
        system=SUMMARY_SYSTEM,
        messages=[
            ChatMessage(
                "user",
                summary_request(
                    topic=lesson.topic, language=lesson.language, transcript=transcript
                ),
            )
        ],
        schema=LessonSummary,
    )
    lesson.summary = _summary_markdown(validate_summary(result.value))
    await session.commit()
    await session.refresh(lesson)
    return lesson
