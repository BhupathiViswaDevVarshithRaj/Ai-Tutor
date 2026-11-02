import uuid
from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, Field, StringConstraints

from app.db.enums import ConversationMode, InputMode, LearningLevel, LessonStatus, MessageRole
from app.schemas.common import LanguageCode, ORMModel

Topic = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class LessonCreate(BaseModel):
    topic: Topic
    level: LearningLevel
    language: LanguageCode


class LessonUpdate(BaseModel):
    status: LessonStatus | None = None
    current_section: Annotated[int, Field(ge=0, le=500)] | None = None
    completed_sections: (
        Annotated[list[Annotated[int, Field(ge=0, le=500)]], Field(max_length=500)] | None
    ) = None


class LessonOut(ORMModel):
    id: uuid.UUID
    topic: str
    level: LearningLevel
    language: LanguageCode
    plan: dict[str, Any] | None
    status: LessonStatus
    current_section: int
    completed_sections: list[int]
    summary: str | None
    created_at: datetime
    updated_at: datetime


class ConversationCreate(BaseModel):
    title: Title
    language: LanguageCode
    level: LearningLevel
    mode: ConversationMode = ConversationMode.TEXT
    lesson_id: uuid.UUID | None = None


class ConversationOut(ORMModel):
    id: uuid.UUID
    lesson_id: uuid.UUID | None
    title: str
    mode: ConversationMode
    language: LanguageCode
    level: LearningLevel
    created_at: datetime
    updated_at: datetime


class MessageCreate(BaseModel):
    content: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=8000)]
    input_mode: InputMode = InputMode.TEXT


class MessageOut(ORMModel):
    id: uuid.UUID
    role: MessageRole
    content: str
    language: LanguageCode
    input_mode: InputMode
    created_at: datetime


class ConversationDetail(ConversationOut):
    messages: list[MessageOut]
