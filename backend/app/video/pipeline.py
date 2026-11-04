"""The video job: script → narration → scene renders → composite → stored files.

Runs in the video worker. The renderer (Manim) and compositor (FFmpeg) are behind small
interfaces so the pipeline can be tested without them.
"""

import asyncio
import logging
import shutil
import tempfile
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol

from sqlalchemy import update

from app.ai.llm.base import ChatMessage, LLMError, LLMProvider
from app.ai.prompts import language_name
from app.ai.speech.base import SpeechError, TTSProvider
from app.db.enums import MediaKind, VideoStatus
from app.db.models import Lesson, MediaAsset, VideoJob
from app.db.session import session_scope
from app.video.images import FoundImage, ImageFinder
from app.video.script import VIDEO_SYSTEM, Scene, VideoScript, validate_script, video_request
from app.video.storage import LocalMediaStorage
from app.video.timing import build_cues, scene_seconds, to_srt, to_vtt

logger = logging.getLogger(__name__)


class RenderError(Exception):
    """Rendering or compositing failed; the message is for logs, not learners."""


class SceneRenderer(Protocol):
    def render(
        self,
        scene: Scene,
        seconds: float,
        index: int,
        workdir: Path,
        language: str,
        image: FoundImage | None = None,
    ) -> Path: ...


class Compositor(Protocol):
    def compose(
        self,
        clips: list[Path],
        audio: list[Path | None],
        durations: list[float],
        subtitles_srt: Path,
        language: str,
        out: Path,
    ) -> None: ...


@dataclass
class VideoDeps:
    llm: LLMProvider
    tts: TTSProvider
    renderer: SceneRenderer
    compositor: Compositor
    storage: LocalMediaStorage
    # Real pictures for `image` scenes; without one, those scenes fall back to text.
    images: ImageFinder | None = None
    # Called with each stage's progress; tests use it to observe the pipeline.
    on_progress: Callable[[VideoStatus, int, str], None] | None = None


class Cancelled(Exception):
    pass


async def _set(
    job_id: uuid.UUID, deps: VideoDeps, status: VideoStatus, progress: int, detail: str, **extra
) -> None:
    """Record progress, unless the learner cancelled the job in the meantime."""
    async with session_scope() as session:
        current = await session.scalar(
            update(VideoJob)
            .where(VideoJob.id == job_id, VideoJob.status != VideoStatus.CANCELLED)
            .values(status=status, progress=progress, stage_detail=detail, **extra)
            .returning(VideoJob.status)
        )
        await session.commit()
    if current is None:
        raise Cancelled
    if deps.on_progress:
        deps.on_progress(status, progress, detail)


def _real_speech(tts: TTSProvider, language: str) -> bool:
    # Mock audio is tones, not speech: a video is better silent (with subtitles) than beeping.
    return (
        tts.unavailable_reason is None and not tts.is_mock and language in tts.supported_languages()
    )


async def run_video_job(job_id: uuid.UUID, deps: VideoDeps) -> None:
    async with session_scope() as session:
        job = await session.get(VideoJob, job_id)
        if job is None or job.status != VideoStatus.QUEUED:
            return  # already handled, cancelled or deleted
        lesson = await session.get(Lesson, job.lesson_id) if job.lesson_id else None
        topic, level, language, seconds = job.topic, job.level, job.language, job.target_seconds
        user_id, plan = job.user_id, lesson.plan if lesson else None

    workdir = Path(tempfile.mkdtemp(prefix=f"video-{job_id}-"))
    try:
        await _set(
            job_id,
            deps,
            VideoStatus.SCRIPTING,
            5,
            "Writing the script",
            started_at=datetime.now(UTC),
        )
        result = await deps.llm.parse(
            system=VIDEO_SYSTEM,
            messages=[
                ChatMessage(
                    "user",
                    video_request(
                        topic=topic,
                        level=level,
                        language_name=language_name(language),
                        seconds=seconds,
                        plan=plan,
                    ),
                )
            ],
            schema=VideoScript,
        )
        script = validate_script(result.value, topic)
        await _set(job_id, deps, VideoStatus.SCRIPTING, 10, "Finding pictures")
        scenes, pictures = await _find_pictures(script.scenes, deps.images, workdir)
        script = VideoScript(title=script.title, scenes=scenes)
        credits = [
            {"scene": i, "title": p.title, "credit": p.credit, "source_url": p.source_url}
            for i, p in sorted(pictures.items())
        ]
        await _set(
            job_id,
            deps,
            VideoStatus.NARRATING,
            15,
            "Recording the narration",
            script={**script.model_dump(), "credits": credits},
        )

        # Narration: real speech when a real voice is configured; otherwise silent.
        narrated = _real_speech(deps.tts, language)
        audio: list[Path | None] = []
        audio_ms: list[int | None] = []
        for i, scene in enumerate(scenes):
            if not narrated:
                audio.append(None)
                audio_ms.append(None)
                continue
            try:
                spoken = await deps.tts.synthesize(scene.narration, language=language)
            except SpeechError as exc:
                logger.warning("narration failed, continuing silent: %s", exc)
                narrated = False
                audio, audio_ms = [None] * len(scenes), [None] * len(scenes)
                break
            path = workdir / f"narration{i}.wav"
            path.write_bytes(spoken.audio)
            audio.append(path)
            audio_ms.append(spoken.duration_ms)
            await _set(
                job_id,
                deps,
                VideoStatus.NARRATING,
                15 + round(15 * (i + 1) / len(scenes)),
                f"Narrating scene {i + 1} of {len(scenes)}",
            )
        durations = [scene_seconds(s.narration, ms) for s, ms in zip(scenes, audio_ms, strict=True)]

        clips: list[Path] = []
        for i, (scene, duration) in enumerate(zip(scenes, durations, strict=True)):
            await _set(
                job_id,
                deps,
                VideoStatus.RENDERING,
                30 + round(55 * i / len(scenes)),
                f"Drawing scene {i + 1} of {len(scenes)}",
            )
            clips.append(
                await asyncio.to_thread(
                    deps.renderer.render, scene, duration, i, workdir, language, pictures.get(i)
                )
            )

        await _set(job_id, deps, VideoStatus.COMPOSITING, 88, "Putting it together")
        cues = build_cues([s.narration for s in scenes], durations)
        srt = workdir / "subtitles.srt"
        srt.write_text(to_srt(cues), encoding="utf-8")
        final = workdir / "video.mp4"
        await asyncio.to_thread(
            deps.compositor.compose, clips, audio, durations, srt, language, final
        )

        base = f"{user_id}/videos/{job_id}"
        total_ms = round(sum(durations) * 1000)
        video_size = deps.storage.put_file(f"{base}/video.mp4", final)
        vtt_size = deps.storage.put_text(f"{base}/subtitles.vtt", to_vtt(cues))
        async with session_scope() as session:
            video = MediaAsset(
                user_id=user_id,
                kind=MediaKind.VIDEO,
                mime_type="video/mp4",
                storage_key=f"{base}/video.mp4",
                size_bytes=video_size,
                duration_ms=total_ms,
                language=language,
                meta={"scenes": len(scenes), "narrated": narrated},
            )
            subtitles = MediaAsset(
                user_id=user_id,
                kind=MediaKind.SUBTITLE,
                mime_type="text/vtt",
                storage_key=f"{base}/subtitles.vtt",
                size_bytes=vtt_size,
                duration_ms=total_ms,
                language=language,
            )
            session.add_all([video, subtitles])
            await session.flush()
            video_id, subtitles_id = video.id, subtitles.id
            await session.commit()
        await _set(
            job_id,
            deps,
            VideoStatus.COMPLETED,
            100,
            "Ready",
            video_asset_id=video_id,
            subtitle_asset_id=subtitles_id,
            narrated=narrated,
            finished_at=datetime.now(UTC),
        )
    except Cancelled:
        logger.info("video %s cancelled", job_id)
    except LLMError as exc:
        await _fail(job_id, exc.user_message)
    except RenderError as exc:
        logger.error("video %s render failed: %s", job_id, exc)
        await _fail(
            job_id, "The video couldn't be drawn. Please try a different topic or try again."
        )
    except Exception:
        logger.exception("video %s failed", job_id)
        await _fail(job_id, "Something went wrong while making the video. Please try again.")
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


async def _find_pictures(
    scenes: list[Scene], finder: ImageFinder | None, workdir: Path
) -> tuple[list[Scene], dict[int, FoundImage]]:
    """Fetch a picture for each `image` scene. A scene without one becomes text: its facts as
    bullets, or a plain card when it has fewer than two."""
    found: dict[int, FoundImage] = {}
    result = []
    for i, scene in enumerate(scenes):
        if scene.template == "image":
            picture = (
                await finder.find(scene.image_query, workdir / f"image{i}.png") if finder else None
            )
            if picture:
                found[i] = picture
            else:
                logger.info("no picture for %r; showing text instead", scene.image_query)
                fallback = "bullets" if len(scene.items) >= 2 else "title"
                scene = scene.model_copy(update={"template": fallback, "image_query": ""})
        result.append(scene)
    return result, found


async def _fail(job_id: uuid.UUID, message: str) -> None:
    async with session_scope() as session:
        await session.execute(
            update(VideoJob)
            .where(VideoJob.id == job_id, VideoJob.status != VideoStatus.CANCELLED)
            .values(status=VideoStatus.FAILED, error=message, finished_at=datetime.now(UTC))
        )
        await session.commit()
