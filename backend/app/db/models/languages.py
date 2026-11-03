"""World-language courses: enrolment and level, vocabulary with spaced repetition, practice."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, TimestampMixin, pg_enum, uuid_pk
from app.db.enums import CefrLevel, PracticeSkill


def _user_fk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))


def _cefr() -> Mapped[CefrLevel]:
    return mapped_column(pg_enum(CefrLevel, "cefr_level"))


class LanguageEnrollment(TimestampMixin, Base):
    """A learner's course in one language and their current CEFR level in it."""

    __tablename__ = "language_enrollments"
    __table_args__ = (UniqueConstraint("user_id", "language"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = _user_fk()
    language: Mapped[str] = mapped_column(String(10))
    level: Mapped[CefrLevel] = _cefr()


class VocabItem(CreatedAtMixin, Base):
    """One word or phrase in a learner's deck, scheduled with SM-2 spaced repetition."""

    __tablename__ = "vocab_items"
    __table_args__ = (
        UniqueConstraint("user_id", "language", "word"),
        Index("ix_vocab_items_user_language_due", "user_id", "language", "due_at"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = _user_fk()
    language: Mapped[str] = mapped_column(String(10))
    word: Mapped[str] = mapped_column(String(200))
    reading: Mapped[str | None] = mapped_column(String(200))
    meaning: Mapped[str] = mapped_column(String(300))
    example: Mapped[str | None] = mapped_column(Text)
    example_translation: Mapped[str | None] = mapped_column(Text)
    level: Mapped[CefrLevel] = _cefr()
    topic: Mapped[str | None] = mapped_column(String(100))
    # SM-2 state.
    ease: Mapped[float] = mapped_column(Float, default=2.5, server_default="2.5")
    interval_days: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    repetitions: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    lapses: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    due_at: Mapped[datetime] = mapped_column(server_default=func.now())
    last_reviewed_at: Mapped[datetime | None]


class PracticeSession(CreatedAtMixin, Base):
    """One generated exercise set (or role-play) and, once submitted, its marked result."""

    __tablename__ = "practice_sessions"
    __table_args__ = (
        Index(
            "ix_practice_sessions_user_language_created",
            "user_id",
            "language",
            text("created_at DESC"),
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = _user_fk()
    language: Mapped[str] = mapped_column(String(10))
    level: Mapped[CefrLevel] = _cefr()
    skill: Mapped[PracticeSkill] = mapped_column(pg_enum(PracticeSkill, "practice_skill"))
    topic: Mapped[str | None] = mapped_column(String(200))
    content: Mapped[dict[str, Any]] = mapped_column(JSONB)
    answers: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    score: Mapped[float | None] = mapped_column(Float)
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="SET NULL"), index=True
    )
    completed_at: Mapped[datetime | None]
