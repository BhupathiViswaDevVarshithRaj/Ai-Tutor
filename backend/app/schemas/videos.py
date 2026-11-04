import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.db.enums import LearningLevel, VideoStatus
from app.schemas.common import LanguageCode

Topic = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=300)]


class VideoCreate(BaseModel):
    topic: Topic
    level: LearningLevel
    language: LanguageCode
    target_seconds: int = Field(default=60, ge=30, le=120)
    lesson_id: uuid.UUID | None = None


class ImageCredit(BaseModel):
    """A picture shown in the video, with the attribution its licence requires."""

    scene: int
    title: str
    credit: str
    source_url: str


class VideoOut(BaseModel):
    id: uuid.UUID
    lesson_id: uuid.UUID | None
    topic: str
    title: str
    language: LanguageCode
    level: LearningLevel
    target_seconds: int
    status: VideoStatus
    progress: int
    stage_detail: str | None
    error: str | None
    # False: the video is silent with subtitles (no real voice is configured yet).
    narrated: bool
    scene_count: int
    image_credits: list[ImageCredit]
    duration_ms: int | None
    # Signed, expiring links usable directly in <video> and <track>.
    video_url: str | None
    subtitles_url: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class VideoWorkerOut(BaseModel):
    online: bool
