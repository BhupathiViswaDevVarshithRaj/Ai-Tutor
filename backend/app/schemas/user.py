import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field, StringConstraints

from app.db.enums import LearningLevel
from app.schemas.common import LanguageCode, ORMModel

Interest = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]


def _dedupe(values: list[str]) -> list[str]:
    seen: dict[str, str] = {}
    for v in values:
        seen.setdefault(v.casefold(), v)
    return list(seen.values())


class PreferencesOut(ORMModel):
    preferred_language: LanguageCode
    learning_level: LearningLevel
    interests: list[str]
    tts_voice: str | None
    tts_speed: float
    theme: Literal["light", "dark", "system"]
    daily_goal_minutes: int


class PreferencesUpdate(BaseModel):
    preferred_language: LanguageCode | None = None
    learning_level: LearningLevel | None = None
    interests: Annotated[list[Interest], Field(max_length=20), AfterValidator(_dedupe)] | None = (
        None
    )
    tts_voice: Annotated[str, StringConstraints(max_length=100)] | None = None
    tts_speed: Annotated[float, Field(ge=0.5, le=2.0)] | None = None
    theme: Literal["light", "dark", "system"] | None = None
    daily_goal_minutes: Annotated[int, Field(ge=5, le=600)] | None = None


class UserOut(ORMModel):
    id: uuid.UUID
    email: str
    full_name: str
    created_at: datetime
    preferences: PreferencesOut


class UserUpdate(BaseModel):
    full_name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
    ]
