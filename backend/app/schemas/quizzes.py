import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

from app.ai.quiz import MAX_QUESTIONS, MIN_QUESTIONS, QuestionTypes
from app.db.enums import LearningLevel, QuestionType
from app.schemas.common import LanguageCode

Topic = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=300)]


class QuizCreate(BaseModel):
    topic: Topic
    level: LearningLevel
    language: LanguageCode
    question_count: Annotated[int, Field(ge=MIN_QUESTIONS, le=MAX_QUESTIONS)] = 10
    question_types: QuestionTypes = "mixed"
    # Link to a lesson; with `section`, a quick check on that section of its plan.
    lesson_id: uuid.UUID | None = None
    section: Annotated[int, Field(ge=0, le=500)] | None = None


class QuestionOut(BaseModel):
    """A question as shown while answering: no answer or explanation."""

    id: uuid.UUID
    position: int
    qtype: QuestionType
    prompt: str
    options: list[str] | None
    concept: str
    difficulty: int


class AttemptSummary(BaseModel):
    id: uuid.UUID
    score: float  # 0-1
    correct: float
    total: int
    submitted_at: datetime


class QuizSummary(BaseModel):
    id: uuid.UUID
    lesson_id: uuid.UUID | None
    title: str
    topic: str
    focus: str | None
    language: LanguageCode
    level: LearningLevel
    question_count: int
    attempts: int
    best_score: float | None
    last_attempt: AttemptSummary | None
    created_at: datetime


class QuizOut(QuizSummary):
    question_types: QuestionTypes
    questions: list[QuestionOut]


class AnswerIn(BaseModel):
    question_id: uuid.UUID
    answer: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)]


class QuizSubmit(BaseModel):
    answers: list[AnswerIn] = Field(max_length=MAX_QUESTIONS)
    duration_seconds: Annotated[int, Field(ge=0, le=24 * 3600)] | None = None


class AnswerResult(BaseModel):
    question_id: uuid.UUID
    position: int
    qtype: QuestionType
    prompt: str
    options: list[str] | None
    concept: str
    answer: str
    correct_answer: str
    is_correct: bool
    score: float  # 0, 0.5 or 1
    explanation: str
    feedback: str | None
    graded_by: Literal["rule", "model"]


class ConceptResult(BaseModel):
    concept: str
    correct: float
    total: int
    score: float


class Recommendation(BaseModel):
    kind: Literal["revise", "advance", "retake"]
    concept: str | None
    text: str
    # revise: a lesson topic to start; advance: the next level to try.
    lesson_topic: str | None = None
    level: LearningLevel | None = None


class SubmissionOut(BaseModel):
    id: uuid.UUID
    quiz_id: uuid.UUID
    score: float  # 0-1
    correct: float
    total: int
    duration_seconds: int | None
    concepts: list[ConceptResult]
    recommendations: list[Recommendation]
    results: list[AnswerResult]
    submitted_at: datetime
