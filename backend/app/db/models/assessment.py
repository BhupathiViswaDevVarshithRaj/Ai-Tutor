"""Quizzes and their attempts (Phase 13), and per-concept mastery built from them."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    Float,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CreatedAtMixin, TimestampMixin, pg_enum, uuid_pk
from app.db.enums import LearningLevel, QuestionType


def _user_fk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))


class Quiz(CreatedAtMixin, Base):
    """A generated quiz. Answers live on the questions and are only shown after an attempt."""

    __tablename__ = "quizzes"
    __table_args__ = (Index("ix_quizzes_user_created", "user_id", text("created_at DESC")),)

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = _user_fk()
    lesson_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    topic: Mapped[str] = mapped_column(String(300))
    # The lesson section a quick understanding check covers, if any.
    focus: Mapped[str | None] = mapped_column(String(300))
    language: Mapped[str] = mapped_column(String(10))
    level: Mapped[LearningLevel] = mapped_column(pg_enum(LearningLevel, "learning_level"))
    # "mixed", "mcq" or "short_answer": what the learner asked for.
    question_types: Mapped[str] = mapped_column(String(20))
    question_count: Mapped[int] = mapped_column(SmallInteger)

    questions: Mapped[list["QuizQuestion"]] = relationship(
        order_by="QuizQuestion.position", cascade="all, delete-orphan", lazy="selectin"
    )


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"
    __table_args__ = (UniqueConstraint("quiz_id", "position"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="CASCADE")
    )
    position: Mapped[int] = mapped_column(SmallInteger)
    qtype: Mapped[QuestionType] = mapped_column(pg_enum(QuestionType, "question_type"))
    prompt: Mapped[str] = mapped_column(Text)
    # Multiple choice only: the options in display order.
    options: Mapped[list[str] | None] = mapped_column(JSONB)
    # The right option (multiple choice) or a model answer (short answer).
    correct_answer: Mapped[str] = mapped_column(Text)
    # Other short answers that count as right without asking the model.
    accepted_answers: Mapped[list[str]] = mapped_column(
        JSONB, default=list, server_default=text("'[]'::jsonb")
    )
    explanation: Mapped[str] = mapped_column(Text)
    concept: Mapped[str] = mapped_column(String(120))
    difficulty: Mapped[int] = mapped_column(SmallInteger)


class QuizSubmission(Base):
    """One attempt at a quiz, with its marks and feedback."""

    __tablename__ = "quiz_submissions"
    __table_args__ = (
        Index("ix_quiz_submissions_user_submitted", "user_id", text("submitted_at DESC")),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = _user_fk()
    score: Mapped[float] = mapped_column(Float)
    max_score: Mapped[float] = mapped_column(Float)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    # {concepts: [{concept, correct, total, score}], recommendations: [...]}
    feedback: Mapped[dict[str, Any]] = mapped_column(JSONB)
    submitted_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    answers: Mapped[list["QuizAnswer"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class QuizAnswer(Base):
    __tablename__ = "quiz_answers"

    id: Mapped[uuid.UUID] = uuid_pk()
    submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quiz_submissions.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quiz_questions.id", ondelete="CASCADE")
    )
    answer: Mapped[str] = mapped_column(Text)
    is_correct: Mapped[bool] = mapped_column(Boolean)
    # 0, 0.5 or 1.
    score: Mapped[float] = mapped_column(Float)
    grader_feedback: Mapped[str | None] = mapped_column(Text)
    # "rule" (matched exactly) or "model" (marked by the AI).
    graded_by: Mapped[str] = mapped_column(String(10))


class TopicMastery(TimestampMixin, Base):
    """How well a learner knows one concept of a topic (0-1), and when to revise it."""

    __tablename__ = "topic_mastery"
    __table_args__ = (
        UniqueConstraint("user_id", "topic_key", "concept_key"),
        Index("ix_topic_mastery_user_mastery", "user_id", "mastery"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = _user_fk()
    # *_key: lowercase, single-spaced, for matching; the others are for display.
    topic_key: Mapped[str] = mapped_column(String(300))
    topic: Mapped[str] = mapped_column(String(300))
    concept_key: Mapped[str] = mapped_column(String(120))
    concept: Mapped[str] = mapped_column(String(120))
    mastery: Mapped[float] = mapped_column(Float)
    evidence_count: Mapped[int] = mapped_column(Integer)
    last_assessed_at: Mapped[datetime]
    next_review_at: Mapped[datetime]
