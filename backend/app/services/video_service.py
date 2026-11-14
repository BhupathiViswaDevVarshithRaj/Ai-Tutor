"""Video jobs from the API side: queueing, status, cancellation, deletion, file links."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Protocol

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError, NotFound
from app.core.redis import get_redis
from app.db.enums import VideoStatus
from app.db.models import MediaAsset, User, VideoJob
from app.schemas.videos import VideoCreate, VideoOut
from app.services.learning_service import get_lesson
from app.video.storage import MediaStorage, media_url

VIDEO_QUEUE = "aitutor:video"
HEALTH_KEY = f"{VIDEO_QUEUE}:health-check"
MAX_ACTIVE_PER_USER = 2
ACTIVE = [s for s in VideoStatus if s.active]


class VideoQueue(Protocol):
    async def enqueue(self, job_id: uuid.UUID) -> None: ...

    async def worker_online(self) -> bool: ...


class ArqVideoQueue:
    """Queues render jobs in Redis for the video worker (app/workers/video.py)."""

    def __init__(self) -> None:
        self._pool: ArqRedis | None = None

    async def _get_pool(self) -> ArqRedis:
        if self._pool is None:
            self._pool = await create_pool(
                RedisSettings.from_dsn(get_settings().redis_url), default_queue_name=VIDEO_QUEUE
            )
        return self._pool

    async def enqueue(self, job_id: uuid.UUID) -> None:
        pool = await self._get_pool()
        await pool.enqueue_job("render_video", str(job_id), _job_id=f"video:{job_id}")

    async def worker_online(self) -> bool:
        # The worker refreshes this key every few seconds (WorkerSettings.health_check_interval).
        return bool(await get_redis().exists(HEALTH_KEY))

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.aclose()
            self._pool = None


video_queue = ArqVideoQueue()


def get_video_queue() -> VideoQueue:
    return video_queue


def to_out(job: VideoJob, assets: dict[uuid.UUID, MediaAsset]) -> VideoOut:
    video = assets.get(job.video_asset_id) if job.video_asset_id else None
    subtitles = assets.get(job.subtitle_asset_id) if job.subtitle_asset_id else None
    script = job.script or {}
    return VideoOut(
        id=job.id,
        lesson_id=job.lesson_id,
        topic=job.topic,
        title=script.get("title") or job.topic,
        language=job.language,
        level=job.level,
        target_seconds=job.target_seconds,
        style=job.style,
        status=job.status,
        progress=job.progress,
        stage_detail=job.stage_detail,
        error=job.error,
        narrated=job.narrated,
        scene_count=len(script.get("scenes", [])),
        image_credits=script.get("credits", []),
        fact_sources=script.get("sources", []),
        fact_checked=bool(script.get("reviewed")),
        duration_ms=video.duration_ms if video else None,
        video_url=media_url(video.id) if video else None,
        subtitles_url=media_url(subtitles.id) if subtitles else None,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
    )


async def assets_for(session: AsyncSession, jobs: list[VideoJob]) -> dict[uuid.UUID, MediaAsset]:
    ids = [i for j in jobs for i in (j.video_asset_id, j.subtitle_asset_id) if i]
    if not ids:
        return {}
    return {
        a.id: a for a in await session.scalars(select(MediaAsset).where(MediaAsset.id.in_(ids)))
    }


async def create(
    session: AsyncSession, queue: VideoQueue, user: User, data: VideoCreate
) -> VideoJob:
    if data.lesson_id is not None:
        await get_lesson(session, user.id, data.lesson_id)  # ownership check
    active = await session.scalar(
        select(func.count())
        .select_from(VideoJob)
        .where(VideoJob.user_id == user.id, VideoJob.status.in_(ACTIVE))
    )
    if (active or 0) >= MAX_ACTIVE_PER_USER:
        raise AppError(
            409, "too_many_videos", "Two videos are already being made. Wait for one to finish."
        )
    job = VideoJob(
        user_id=user.id,
        lesson_id=data.lesson_id,
        topic=data.topic,
        language=data.language,
        level=data.level,
        target_seconds=data.target_seconds,
        style=data.style,
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)
    await queue.enqueue(job.id)
    return job


async def _expire_stalled(session: AsyncSession, jobs: list[VideoJob]) -> None:
    """A job the worker stopped updating (e.g. it was killed) is failed, not left spinning."""
    limit = timedelta(seconds=get_settings().video_job_timeout_seconds + 120)
    now = datetime.now(UTC)
    stalled = [
        j
        for j in jobs
        if j.status.active
        and j.status != VideoStatus.QUEUED
        and j.started_at
        and now - j.started_at > limit
    ]
    for job in stalled:
        job.status = VideoStatus.FAILED
        job.error = "Making the video took too long. Please try again."
        job.finished_at = now
    if stalled:
        await session.commit()


async def list_jobs(
    session: AsyncSession, user_id: uuid.UUID, *, lesson_id: uuid.UUID | None, limit: int
) -> list[VideoJob]:
    query = select(VideoJob).where(VideoJob.user_id == user_id)
    if lesson_id is not None:
        query = query.where(VideoJob.lesson_id == lesson_id)
    jobs = list(await session.scalars(query.order_by(VideoJob.created_at.desc()).limit(limit)))
    await _expire_stalled(session, jobs)
    return jobs


async def get_job(session: AsyncSession, user_id: uuid.UUID, job_id: uuid.UUID) -> VideoJob:
    job = await session.get(VideoJob, job_id)
    if job is None or job.user_id != user_id:
        raise NotFound("Video")
    await _expire_stalled(session, [job])
    return job


async def cancel(session: AsyncSession, user_id: uuid.UUID, job_id: uuid.UUID) -> VideoJob:
    job = await get_job(session, user_id, job_id)
    if not job.status.active:
        raise AppError(409, "not_running", "This video isn't being made any more.")
    # The worker checks for this between stages and stops.
    await session.execute(
        update(VideoJob)
        .where(VideoJob.id == job.id)
        .values(
            status=VideoStatus.CANCELLED, stage_detail="Cancelled", finished_at=datetime.now(UTC)
        )
    )
    await session.commit()
    await session.refresh(job)
    return job


async def delete(
    session: AsyncSession, storage: MediaStorage, user_id: uuid.UUID, job_id: uuid.UUID
) -> None:
    job = await get_job(session, user_id, job_id)
    if job.status.active:
        raise AppError(409, "still_running", "Cancel the video before deleting it.")
    assets = list((await assets_for(session, [job])).values())
    await session.delete(job)
    for asset in assets:
        await storage.remove(asset.storage_key)
        await session.delete(asset)
    await session.commit()
