from typing import Annotated

from pydantic import BaseModel, StringConstraints

from app.db.enums import InputMode, LearningLevel
from app.schemas.common import LanguageCode
from app.schemas.learning import ConversationOut, LessonOut

Topic = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=300)]


class LessonGenerate(BaseModel):
    topic: Topic
    level: LearningLevel
    language: LanguageCode


class LessonStart(BaseModel):
    lesson: LessonOut
    conversation: ConversationOut


class TutorMessageIn(BaseModel):
    content: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=8000)]
    input_mode: InputMode = InputMode.TEXT


class AIInfo(BaseModel):
    provider: str
    is_mock: bool
    tutor_model: str
    structured_model: str
