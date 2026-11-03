import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.ai.mindmap import MindMapGraph
from app.db.enums import LearningLevel
from app.schemas.common import LanguageCode

Topic = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=300)]
NodeId = Annotated[str, StringConstraints(min_length=1, max_length=40)]


class MindMapCreate(BaseModel):
    topic: Topic
    level: LearningLevel
    language: LanguageCode
    # Build the map from this lesson's plan (and link it to the lesson).
    lesson_id: uuid.UUID | None = None


class Position(BaseModel):
    x: float
    y: float


class MindMapLayout(BaseModel):
    positions: dict[NodeId, Position] = Field(default_factory=dict, max_length=200)
    collapsed: list[NodeId] = Field(default_factory=list, max_length=200)


class MindMapUpdate(BaseModel):
    title: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
        | None
    ) = None
    graph: MindMapGraph | None = None
    layout: MindMapLayout | None = None
    # Required with `graph`: the version the edit was based on (stale edits get 409).
    version: int | None = None


class MindMapExpand(BaseModel):
    node_id: NodeId
    version: int


class MindMapOut(BaseModel):
    id: uuid.UUID
    lesson_id: uuid.UUID | None
    topic: str
    language: LanguageCode
    level: LearningLevel
    graph: MindMapGraph
    layout: MindMapLayout | None
    version: int
    created_at: datetime
    updated_at: datetime


class MindMapSummary(BaseModel):
    id: uuid.UUID
    lesson_id: uuid.UUID | None
    title: str
    topic: str
    language: LanguageCode
    level: LearningLevel
    node_count: int
    updated_at: datetime
