import uuid
from datetime import date, datetime

from pydantic import BaseModel


class LessonCounts(BaseModel):
    total: int
    active: int
    completed: int
    sections_completed: int


class QuizCounts(BaseModel):
    quizzes: int
    attempts: int
    average_score: float | None  # 0-1, over all attempts
    best_score: float | None


class Activity(BaseModel):
    today: date  # UTC, the day `days` are counted up to
    streak_days: int
    active_days_last_30: int
    # Days with any learning activity in the last 30 days (oldest first).
    days: list[date]


class ScorePoint(BaseModel):
    submission_id: uuid.UUID
    quiz_id: uuid.UUID
    title: str
    score: float
    submitted_at: datetime


class ConceptMastery(BaseModel):
    topic: str
    concept: str
    mastery: float  # 0-1
    evidence_count: int
    last_assessed_at: datetime
    next_review_at: datetime
    due: bool


class ProgressOut(BaseModel):
    lessons: LessonCounts
    quizzes: QuizCounts
    activity: Activity
    # The latest attempts, oldest first (for a trend).
    scores: list[ScorePoint]
    strong: list[ConceptMastery]
    weak: list[ConceptMastery]
    # Ideas due for revision now or within a week, soonest first.
    revision: list[ConceptMastery]
