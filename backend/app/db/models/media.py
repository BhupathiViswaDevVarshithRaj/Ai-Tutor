"""Media files (Phase 12) and the video generation jobs that produce them."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, ForeignKey, Index, Integer, SmallInteger, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, pg_enum, uuid_pk
from app.db.enums import LearningLevel, MediaKind, VideoStatus


def _user_fk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))


class MediaAsset(CreatedAtMixin, Base):
    """A stored file. Served only through authenticated routes or short-lived signed links."""

    __tablename__ = "media_assets"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = _user_fk()
    kind: Mapped[MediaKind] = mapped_column(pg_enum(MediaKind, "media_kind"))
    mime_type: Mapped[str] = mapped_column(String(100))
    storage_key: Mapped[str] = mapped_column(String(500), unique=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    language: Mapped[str | None] = mapped_column(String(10))
    meta: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb")
    )


class VideoJob(CreatedAtMixin, Base):
    """One short explainer video: queued, scripted, narrated, rendered and composited."""

    __tablename__ = "video_jobs"
    __table_args__ = (
        Index("ix_video_jobs_user_created", "user_id", text("created_at DESC")),
        Index("ix_video_jobs_status", "status"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = _user_fk()
    lesson_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="SET NULL"), index=True
    )
    topic: Mapped[str] = mapped_column(String(300))
    language: Mapped[str] = mapped_column(String(10))
    level: Mapped[LearningLevel] = mapped_column(pg_enum(LearningLevel, "learning_level"))
    target_seconds: Mapped[int] = mapped_column(SmallInteger)
    status: Mapped[VideoStatus] = mapped_column(
        pg_enum(VideoStatus, "video_status"),
        default=VideoStatus.QUEUED,
        server_default=VideoStatus.QUEUED.value,
    )
    progress: Mapped[int] = mapped_column(SmallInteger, default=0, server_default="0")
    stage_detail: Mapped[str | None] = mapped_column(String(200))
    script: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    error: Mapped[str | None] = mapped_column(Text)
    video_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL")
    )
    subtitle_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL")
    )
    # True when the narration is real speech; false when the video is silent or uses mock audio.
    narrated: Mapped[bool] = mapped_column(default=False, server_default="false")
    started_at: Mapped[datetime | None]
    finished_at: Mapped[datetime | None]
