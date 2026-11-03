import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, StringConstraints

from app.db.enums import CefrLevel, PracticeSkill
from app.schemas.common import CourseLanguage, ORMModel

ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class CourseOut(BaseModel):
    code: CourseLanguage
    name: str
    enrolled: bool
    level: CefrLevel | None
    words: int
    due: int
    last_practised: datetime | None


class EnrollIn(BaseModel):
    level: CefrLevel


class EnrollmentOut(ORMModel):
    language: CourseLanguage
    level: CefrLevel
    created_at: datetime
    updated_at: datetime


class VocabGenerateIn(BaseModel):
    topic: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None


class VocabItemOut(ORMModel):
    id: uuid.UUID
    language: CourseLanguage
    word: str
    reading: str | None
    meaning: str
    example: str | None
    example_translation: str | None
    level: CefrLevel
    topic: str | None
    repetitions: int
    interval_days: int
    due_at: datetime
    last_reviewed_at: datetime | None
    created_at: datetime


class VocabReviewIn(BaseModel):
    grade: Literal["again", "hard", "good", "easy"]


class PracticeStartIn(BaseModel):
    skill: PracticeSkill
    topic: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None = None
    # Conversation practice only: the role-play situation.
    scenario: ShortText | None = None


class PracticeSubmitIn(BaseModel):
    """Grammar, listening, reading: `answers`. Writing: `text`. Speaking: `transcripts`."""

    answers: list[Annotated[str, StringConstraints(max_length=500)]] | None = Field(
        default=None, max_length=20
    )
    text: Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)] | None = None
    transcripts: list[Annotated[str, StringConstraints(max_length=1000)]] | None = Field(
        default=None, max_length=20
    )


class PracticeSessionOut(BaseModel):
    id: uuid.UUID
    language: CourseLanguage
    level: CefrLevel
    skill: PracticeSkill
    topic: str | None
    # Before submission, exercise answers and explanations are left out.
    content: dict[str, Any]
    answers: dict[str, Any] | None
    result: dict[str, Any] | None
    score: float | None
    conversation_id: uuid.UUID | None
    created_at: datetime
    completed_at: datetime | None


class PracticeSummaryOut(BaseModel):
    id: uuid.UUID
    skill: PracticeSkill
    level: CefrLevel
    title: str
    score: float | None
    conversation_id: uuid.UUID | None
    created_at: datetime
    completed_at: datetime | None


class WordStats(BaseModel):
    total: int
    learned: int
    mastered: int
    due: int


class SkillStats(BaseModel):
    sessions: int
    completed: int
    average_score: float | None
    last_practised: datetime | None


class ProgressOut(BaseModel):
    language: CourseLanguage
    level: CefrLevel | None
    words: WordStats
    skills: dict[PracticeSkill, SkillStats]
    streak_days: int
    active_days_last_7: int
