import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import FileResponse

from app.api.deps import CurrentUser, SessionDep, UserRateLimiter
from app.core.errors import NotFound
from app.db.models import MediaAsset
from app.schemas.videos import VideoCreate, VideoOut, VideoWorkerOut
from app.services import video_service
from app.services.video_service import VideoQueue, get_video_queue
from app.video.storage import LocalMediaStorage, check_media_token, get_storage

router = APIRouter(prefix="/videos", tags=["videos"])
media_router = APIRouter(prefix="/media", tags=["media"])

Queue = Annotated[VideoQueue, Depends(get_video_queue)]
Storage = Annotated[LocalMediaStorage, Depends(get_storage)]
VIDEO_LIMIT = [Depends(UserRateLimiter("video", "video_rate_limit", "video_rate_window_seconds"))]


@router.get("")
async def list_videos(
    user: CurrentUser,
    session: SessionDep,
    lesson_id: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> list[VideoOut]:
    jobs = await video_service.list_jobs(session, user.id, lesson_id=lesson_id, limit=limit)
    assets = await video_service.assets_for(session, jobs)
    return [video_service.to_out(j, assets) for j in jobs]


@router.post("", status_code=status.HTTP_202_ACCEPTED, dependencies=VIDEO_LIMIT)
async def create_video(
    data: VideoCreate, user: CurrentUser, session: SessionDep, queue: Queue
) -> VideoOut:
    """Queue a short explainer video. Poll `GET /videos/{id}` for progress."""
    job = await video_service.create(session, queue, user, data)
    return video_service.to_out(job, {})


@router.get("/worker")
async def worker_status(_: CurrentUser, queue: Queue) -> VideoWorkerOut:
    """Whether the video worker is running (videos wait in the queue until it is)."""
    return VideoWorkerOut(online=await queue.worker_online())


@router.get("/{job_id}")
async def get_video(job_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> VideoOut:
    job = await video_service.get_job(session, user.id, job_id)
    return video_service.to_out(job, await video_service.assets_for(session, [job]))


@router.post("/{job_id}/cancel")
async def cancel_video(job_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> VideoOut:
    job = await video_service.cancel(session, user.id, job_id)
    return video_service.to_out(job, {})


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video(
    job_id: uuid.UUID, user: CurrentUser, session: SessionDep, storage: Storage
) -> None:
    await video_service.delete(session, storage, user.id, job_id)


@media_router.get("/{asset_id}", include_in_schema=False)
async def get_media(
    asset_id: uuid.UUID, token: str, session: SessionDep, storage: Storage
) -> FileResponse:
    """A stored file, for a valid signed link (supports Range requests for video seeking)."""
    if not check_media_token(asset_id, token):
        raise NotFound("File")
    asset = await session.get(MediaAsset, asset_id)
    if asset is None:
        raise NotFound("File")
    path = storage.path(asset.storage_key)
    if not path.is_file():
        raise NotFound("File")
    return FileResponse(
        path, media_type=asset.mime_type, headers={"Cache-Control": "private, max-age=3600"}
    )
