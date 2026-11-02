import uuid
from typing import Any

from sqlalchemy import ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CreatedAtMixin, TimestampMixin, pg_enum, uuid_pk
from app.db.enums import ConversationMode, InputMode, LearningLevel, LessonStatus, MessageRole


def _user_fk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))


class Lesson(TimestampMixin, Base):
    """A learning track on one topic. `plan` is filled by the AI tutor (Phase 4)."""

    __tablename__ = "lessons"
    __table_args__ = (
        Index("ix_lessons_user_updated", "user_id", text("updated_at DESC")),
        Index("ix_lessons_user_status", "user_id", "status"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = _user_fk()
    topic: Mapped[str] = mapped_column(String(300))
    level: Mapped[LearningLevel] = mapped_column(pg_enum(LearningLevel, "learning_level"))
    language: Mapped[str] = mapped_column(String(10))
    plan: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    status: Mapped[LessonStatus] = mapped_column(
        pg_enum(LessonStatus, "lesson_status"),
        default=LessonStatus.ACTIVE,
        server_default=LessonStatus.ACTIVE.value,
    )
    current_section: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    completed_sections: Mapped[list[int]] = mapped_column(
        ARRAY(Integer), default=list, server_default=text("'{}'")
    )
    summary: Mapped[str | None] = mapped_column(Text)


class Conversation(TimestampMixin, Base):
    __tablename__ = "conversations"
    __table_args__ = (Index("ix_conversations_user_updated", "user_id", text("updated_at DESC")),)

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = _user_fk()
    lesson_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    mode: Mapped[ConversationMode] = mapped_column(
        pg_enum(ConversationMode, "conversation_mode"),
        default=ConversationMode.TEXT,
        server_default=ConversationMode.TEXT.value,
    )
    language: Mapped[str] = mapped_column(String(10))
    level: Mapped[LearningLevel] = mapped_column(pg_enum(LearningLevel, "learning_level"))

    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Message.created_at",
    )


class Message(CreatedAtMixin, Base):
    __tablename__ = "messages"
    __table_args__ = (Index("ix_messages_conversation_created", "conversation_id", "created_at"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE")
    )
    # Denormalised owner for isolation checks without a join.
    user_id: Mapped[uuid.UUID] = _user_fk()
    role: Mapped[MessageRole] = mapped_column(pg_enum(MessageRole, "message_role"))
    content: Mapped[str] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(10))
    input_mode: Mapped[InputMode] = mapped_column(
        pg_enum(InputMode, "input_mode"),
        default=InputMode.TEXT,
        server_default=InputMode.TEXT.value,
    )
    # FK to media_assets is added with that table in migration 0006.
    audio_asset_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    model: Mapped[str | None] = mapped_column(String(100))
    input_tokens: Mapped[int | None]
    output_tokens: Mapped[int | None]
    meta: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb")
    )

    conversation: Mapped[Conversation] = relationship(back_populates="messages")
