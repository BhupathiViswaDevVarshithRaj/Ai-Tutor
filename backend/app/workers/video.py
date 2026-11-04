"""The video worker: `python -m arq app.workers.video.WorkerSettings` (service video-worker)."""

import logging
import uuid

from arq.connections import RedisSettings

from app.ai.llm.factory import get_video_llm
from app.ai.speech.factory import get_tts
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.redis import close_redis
from app.db.session import dispose_engine
from app.services.video_service import VIDEO_QUEUE
from app.video.pipeline import VideoDeps, run_video_job
from app.video.render import FFmpegCompositor, ManimRenderer
from app.video.storage import get_storage

logger = logging.getLogger(__name__)


async def startup(ctx: dict) -> None:
    configure_logging()
    settings = get_settings()
    ctx["deps"] = VideoDeps(
        llm=get_video_llm(),
        tts=get_tts(),
        renderer=ManimRenderer(settings.video_quality),
        compositor=FFmpegCompositor(settings.video_quality),
        storage=get_storage(),
    )
    logger.info(
        "video worker ready (quality=%s, media=%s)", settings.video_quality, settings.media_root
    )


async def shutdown(ctx: dict) -> None:
    await dispose_engine()
    await close_redis()


async def render_video(ctx: dict, job_id: str) -> None:
    await run_video_job(uuid.UUID(job_id), ctx["deps"])


class WorkerSettings:
    functions = [render_video]
    on_startup = startup
    on_shutdown = shutdown
    queue_name = VIDEO_QUEUE
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
    # Rendering is CPU-heavy: one video at a time per worker.
    max_jobs = 1
    job_timeout = get_settings().video_job_timeout_seconds
    max_tries = 1
    # Refresh the "worker online" key often so the app can show whether the worker is running.
    health_check_interval = 15
