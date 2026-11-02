"""Lessons, conversations and messages. Every query is scoped to the owning user."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import NotFound
from app.db.enums import LessonStatus, MessageRole
from app.db.models import Conversation, Lesson, Message
from app.schemas.learning import (
    ConversationCreate,
    LessonCreate,
    LessonUpdate,
    MessageCreate,
)

# --- Lessons ---------------------------------------------------------------


async def list_lessons(
    session: AsyncSession,
    user_id: uuid.UUID,
    *,
    status: LessonStatus | None,
    limit: int,
    offset: int,
) -> tuple[list[Lesson], int]:
    filters = [Lesson.user_id == user_id]
    if status is not None:
        filters.append(Lesson.status == status)
    total = await session.scalar(select(func.count()).select_from(Lesson).where(*filters))
    rows = await session.scalars(
        select(Lesson)
        .where(*filters)
        .order_by(Lesson.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(rows), total or 0


async def get_lesson(session: AsyncSession, user_id: uuid.UUID, lesson_id: uuid.UUID) -> Lesson:
    lesson = await session.scalar(
        select(Lesson).where(Lesson.id == lesson_id, Lesson.user_id == user_id)
    )
    if lesson is None:
        raise NotFound("Lesson")
    return lesson


async def create_lesson(session: AsyncSession, user_id: uuid.UUID, data: LessonCreate) -> Lesson:
    lesson = Lesson(user_id=user_id, topic=data.topic, level=data.level, language=data.language)
    session.add(lesson)
    await session.commit()
    await session.refresh(lesson)
    return lesson


async def update_lesson(
    session: AsyncSession, user_id: uuid.UUID, lesson_id: uuid.UUID, data: LessonUpdate
) -> Lesson:
    lesson = await get_lesson(session, user_id, lesson_id)
    for field, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(lesson, field, value)
    await session.commit()
    await session.refresh(lesson)
    return lesson


async def delete_lesson(session: AsyncSession, user_id: uuid.UUID, lesson_id: uuid.UUID) -> None:
    lesson = await get_lesson(session, user_id, lesson_id)
    await session.delete(lesson)
    await session.commit()


# --- Conversations ---------------------------------------------------------


async def list_conversations(
    session: AsyncSession,
    user_id: uuid.UUID,
    *,
    lesson_id: uuid.UUID | None,
    limit: int,
    offset: int,
) -> tuple[list[Conversation], int]:
    filters = [Conversation.user_id == user_id]
    if lesson_id is not None:
        filters.append(Conversation.lesson_id == lesson_id)
    total = await session.scalar(select(func.count()).select_from(Conversation).where(*filters))
    rows = await session.scalars(
        select(Conversation)
        .where(*filters)
        .order_by(Conversation.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(rows), total or 0


async def get_conversation(
    session: AsyncSession, user_id: uuid.UUID, conversation_id: uuid.UUID, *, with_messages: bool
) -> Conversation:
    query = select(Conversation).where(
        Conversation.id == conversation_id, Conversation.user_id == user_id
    )
    if with_messages:
        query = query.options(selectinload(Conversation.messages))
    conversation = await session.scalar(query)
    if conversation is None:
        raise NotFound("Conversation")
    return conversation


async def create_conversation(
    session: AsyncSession, user_id: uuid.UUID, data: ConversationCreate
) -> Conversation:
    if data.lesson_id is not None:
        await get_lesson(session, user_id, data.lesson_id)  # ownership check
    conversation = Conversation(user_id=user_id, **data.model_dump())
    session.add(conversation)
    await session.commit()
    await session.refresh(conversation)
    return conversation


async def delete_conversation(
    session: AsyncSession, user_id: uuid.UUID, conversation_id: uuid.UUID
) -> None:
    conversation = await get_conversation(session, user_id, conversation_id, with_messages=False)
    await session.delete(conversation)
    await session.commit()


async def add_user_message(
    session: AsyncSession, user_id: uuid.UUID, conversation_id: uuid.UUID, data: MessageCreate
) -> Message:
    conversation = await get_conversation(session, user_id, conversation_id, with_messages=False)
    message = Message(
        conversation_id=conversation.id,
        user_id=user_id,
        role=MessageRole.USER,
        content=data.content,
        language=conversation.language,
        input_mode=data.input_mode,
    )
    session.add(message)
    conversation.updated_at = func.now()
    await session.commit()
    await session.refresh(message)
    return message
