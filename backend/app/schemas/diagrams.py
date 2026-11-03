import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

from app.ai.diagram import DiagramSpec
from app.db.enums import DiagramType, LearningLevel
from app.schemas.common import LanguageCode

Topic = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=300)]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]

MAX_STROKES = 500
MAX_STROKE_POINTS = 2000
MAX_TOTAL_POINTS = 50_000


class DiagramCreate(BaseModel):
    topic: Topic
    level: LearningLevel
    language: LanguageCode
    # "auto" lets the model pick the clearest type.
    diagram_type: Literal["auto", "flowchart", "block", "timeline", "graph_fn", "process"] = "auto"
    lesson_id: uuid.UUID | None = None


class SketchCreate(BaseModel):
    title: Title
    level: LearningLevel
    language: LanguageCode


class Stroke(BaseModel):
    tool: Literal["pen", "highlighter"]
    color: Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]
    width: float = Field(ge=1, le=40)
    points: list[tuple[float, float]] = Field(min_length=1, max_length=MAX_STROKE_POINTS)


class DiagramUpdate(BaseModel):
    title: Title | None = None
    strokes: list[Stroke] | None = Field(default=None, max_length=MAX_STROKES)


class DiagramOut(BaseModel):
    id: uuid.UUID
    lesson_id: uuid.UUID | None
    title: str
    topic: str | None
    language: LanguageCode
    level: LearningLevel
    diagram_type: DiagramType
    spec: DiagramSpec | None
    strokes: list[Stroke]
    created_at: datetime
    updated_at: datetime


class DiagramSummary(BaseModel):
    id: uuid.UUID
    lesson_id: uuid.UUID | None
    title: str
    diagram_type: DiagramType
    step_count: int
    stroke_count: int
    updated_at: datetime
