"""Videos: the API (queue, status, cancel, delete, signed media) and the pipeline (fake render)."""

import asyncio
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import select, update

from app.ai.llm.base import LLMRefusal
from app.ai.llm.mock_provider import MockLLMProvider
from app.ai.speech.base import AudioResult
from app.ai.speech.mock import MockTTSProvider
from app.core.config import get_settings
from app.db.enums import VideoStatus
from app.db.models import MediaAsset, VideoJob
from app.db.session import session_scope
from app.services.video_service import get_video_queue
from app.video.pipeline import RenderError, VideoDeps, run_video_job
from app.video.storage import get_storage
from tests.conftest import API, register_user

pytestmark = pytest.mark.integration

V = f"{API}/videos"
REQUEST = {"topic": "Photosynthesis", "level": "beginner", "language": "hi", "target_seconds": 45}


class FakeQueue:
    def __init__(self, online: bool = True) -> None:
        self.jobs: list[uuid.UUID] = []
        self.online = online

    async def enqueue(self, job_id: uuid.UUID) -> None:
        self.jobs.append(job_id)

    async def worker_online(self) -> bool:
        return self.online


class FakeRenderer:
    """Writes a tiny stand-in clip per scene and records what it was asked to draw."""

    def __init__(self, on_render=None, fail_at: int | None = None) -> None:
        self.calls: list[tuple[str, float, str]] = []
        self.on_render = on_render
        self.fail_at = fail_at

    def render(self, scene, seconds, index, workdir: Path, language):
        if self.on_render:
            self.on_render(index)
        if index == self.fail_at:
            raise RenderError("manim crashed")
        self.calls.append((scene.template, seconds, language))
        clip = workdir / f"scene{index}.mp4"
        clip.write_bytes(b"clip")
        return clip


class FakeCompositor:
    def __init__(self) -> None:
        self.calls = []

    def compose(self, clips, audio, durations, subtitles_srt, language, out: Path):
        self.calls.append(
            (
                len(clips),
                [a is not None for a in audio],
                durations,
                subtitles_srt.read_text(encoding="utf-8"),
                language,
            )
        )
        out.write_bytes(b"\x00\x00\x00\x18ftypmp42" + b"v" * 5000)  # looks like an mp4


class RealVoice(MockTTSProvider):
    """A TTS provider that counts as real speech (not a mock), for the narrated path."""

    is_mock = False

    async def synthesize(self, text, *, language, voice=None, speed=1.0):
        return AudioResult(audio=b"RIFFfake", mime_type="audio/wav", duration_ms=2500, voice="v")


@pytest.fixture
def queue(app):
    fake = FakeQueue()
    app.dependency_overrides[get_video_queue] = lambda: fake
    return fake


def deps(renderer=None, tts=None, llm=None):
    return VideoDeps(
        llm=llm or MockLLMProvider(),
        tts=tts or MockTTSProvider(),
        renderer=renderer or FakeRenderer(),
        compositor=FakeCompositor(),
        storage=get_storage(),
    )


async def create(api, headers, **overrides):
    resp = await api.post(V, headers=headers, json={**REQUEST, **overrides})
    assert resp.status_code == 202, resp.text
    return resp.json()


async def test_queues_a_video_job(api, queue):
    headers = await register_user(api)
    job = await create(api, headers)
    assert job["status"] == "queued" and job["progress"] == 0 and job["video_url"] is None
    assert queue.jobs == [uuid.UUID(job["id"])]
    listed = (await api.get(V, headers=headers)).json()
    assert [j["id"] for j in listed] == [job["id"]]
    assert (await api.get(f"{V}/worker", headers=headers)).json() == {"online": True}


async def test_validation_limits_and_lessons(api, queue, monkeypatch):
    monkeypatch.setattr(get_settings(), "video_rate_limit", 100)  # many requests in this test
    headers = await register_user(api)
    for bad in (
        {"target_seconds": 10},
        {"target_seconds": 200},
        {"topic": "x"},
        {"language": "de"},
    ):
        assert (await api.post(V, headers=headers, json={**REQUEST, **bad})).status_code == 422
    await create(api, headers)
    await create(api, headers)
    third = await api.post(V, headers=headers, json=REQUEST)
    assert third.status_code == 409 and third.json()["code"] == "too_many_videos"

    other = await register_user(api, email="other@example.com")
    resp = await api.post(V, headers=other, json={**REQUEST, "lesson_id": str(uuid.uuid4())})
    assert resp.status_code == 404


async def test_pipeline_makes_a_silent_video_with_subtitles(api, queue):
    headers = await register_user(api)
    job = await create(api, headers)
    renderer, stages = FakeRenderer(), []
    d = deps(renderer)
    d.on_progress = lambda status, progress, detail: stages.append((status, progress))
    await run_video_job(uuid.UUID(job["id"]), d)

    done = (await api.get(f"{V}/{job['id']}", headers=headers)).json()
    assert done["status"] == "completed" and done["progress"] == 100
    assert done["title"] == "Photosynthesis (mock video)" and done["scene_count"] == 4
    # The mock voice is tones, not speech: the video is silent with subtitles.
    assert done["narrated"] is False
    assert [t for t, _, _ in renderer.calls] == ["title", "bullets", "flow", "summary"]
    assert all(lang == "hi" for _, _, lang in renderer.calls)
    statuses = [s for s, _ in stages]
    assert statuses[0] == VideoStatus.SCRIPTING and statuses[-1] == VideoStatus.COMPLETED
    assert [p for _, p in stages] == sorted(p for _, p in stages)  # progress only goes up
    assert done["duration_ms"] == round(sum(sec for _, sec, _ in renderer.calls) * 1000)

    # The signed links serve the files; the video supports seeking (Range requests).
    video = await api.get(done["video_url"])
    assert video.status_code == 200 and video.headers["content-type"] == "video/mp4"
    part = await api.get(done["video_url"], headers={"Range": "bytes=0-99"})
    assert part.status_code == 206 and len(part.content) == 100
    vtt = await api.get(done["subtitles_url"])
    assert (
        vtt.text.startswith("WEBVTT") and "This is a mock video about Photosynthesis." in vtt.text
    )


async def test_media_links_need_a_valid_signature(api, queue):
    headers = await register_user(api)
    job = await create(api, headers)
    await run_video_job(uuid.UUID(job["id"]), deps())
    url = (await api.get(f"{V}/{job['id']}", headers=headers)).json()["video_url"]
    asset_path, token = url.split("?token=")
    expires, signature = token.split(".")
    assert (await api.get(f"{asset_path}?token={int(expires) + 1}.{signature}")).status_code == 404
    assert (await api.get(asset_path)).status_code == 422  # no token at all
    assert (await api.get(f"{API}/media/{uuid.uuid4()}?token={token}")).status_code == 404


async def test_real_speech_sets_scene_lengths(api, queue):
    headers = await register_user(api)
    job = await create(api, headers)
    renderer = FakeRenderer()
    await run_video_job(uuid.UUID(job["id"]), deps(renderer, tts=RealVoice()))
    done = (await api.get(f"{V}/{job['id']}", headers=headers)).json()
    assert done["narrated"] is True
    assert all(seconds == 2.5 + 0.8 for _, seconds, _ in renderer.calls)  # audio length + pause


async def test_cancelling_stops_the_pipeline(api, queue):
    headers = await register_user(api)
    job = await create(api, headers)
    job_id = uuid.UUID(job["id"])

    # Rendering runs in a worker thread: cancel on the test's event loop, as the API would.
    loop = asyncio.get_running_loop()

    def cancel_during_scene(index):
        if index == 1:
            asyncio.run_coroutine_threadsafe(_cancel(job_id), loop).result(timeout=10)

    renderer = FakeRenderer(on_render=cancel_during_scene)
    await run_video_job(job_id, deps(renderer))
    final = (await api.get(f"{V}/{job_id}", headers=headers)).json()
    assert final["status"] == "cancelled" and final["video_url"] is None
    assert len(renderer.calls) == 2  # stopped before scene 3


async def _cancel(job_id):
    async with session_scope() as session:
        await session.execute(
            update(VideoJob).where(VideoJob.id == job_id).values(status=VideoStatus.CANCELLED)
        )
        await session.commit()


async def test_cancel_and_delete_through_the_api(api, queue):
    headers = await register_user(api)
    job = await create(api, headers)
    url = f"{V}/{job['id']}"
    assert (await api.delete(url, headers=headers)).status_code == 409  # still running
    cancelled = (await api.post(f"{url}/cancel", headers=headers)).json()
    assert cancelled["status"] == "cancelled"
    assert (await api.post(f"{url}/cancel", headers=headers)).status_code == 409
    # A cancelled job is skipped if the worker picks it up later.
    await run_video_job(uuid.UUID(job["id"]), deps())
    assert (await api.get(url, headers=headers)).json()["status"] == "cancelled"
    assert (await api.delete(url, headers=headers)).status_code == 204
    assert (await api.get(url, headers=headers)).status_code == 404


async def test_deleting_a_video_removes_its_files(api, queue):
    headers = await register_user(api)
    job = await create(api, headers)
    await run_video_job(uuid.UUID(job["id"]), deps())
    async with session_scope() as session:
        keys = list(await session.scalars(select(MediaAsset.storage_key)))
    paths = [get_settings().media_root / k for k in keys]
    assert len(paths) == 2 and all(p.exists() for p in paths)
    assert (await api.delete(f"{V}/{job['id']}", headers=headers)).status_code == 204
    assert not any(p.exists() for p in paths)
    async with session_scope() as session:
        assert list(await session.scalars(select(MediaAsset))) == []


async def test_failures_are_reported_kindly(api, queue):
    headers = await register_user(api)
    first = await create(api, headers)
    await run_video_job(uuid.UUID(first["id"]), deps(FakeRenderer(fail_at=2)))
    failed = (await api.get(f"{V}/{first['id']}", headers=headers)).json()
    assert failed["status"] == "failed" and "couldn't be drawn" in failed["error"]
    assert "manim" not in failed["error"]  # internal details stay in the logs

    class Refusing(MockLLMProvider):
        async def parse(self, **_):
            raise LLMRefusal()

    second = await create(api, headers)
    await run_video_job(uuid.UUID(second["id"]), deps(llm=Refusing()))
    refused = (await api.get(f"{V}/{second['id']}", headers=headers)).json()
    assert refused["status"] == "failed" and refused["error"].startswith("The tutor can't help")


async def test_a_stalled_job_is_marked_failed(api, queue):
    headers = await register_user(api)
    job = await create(api, headers)
    long_ago = datetime.now(UTC) - timedelta(hours=2)
    async with session_scope() as session:
        await session.execute(
            update(VideoJob)
            .where(VideoJob.id == uuid.UUID(job["id"]))
            .values(status=VideoStatus.RENDERING, started_at=long_ago)
        )
        await session.commit()
    stalled = (await api.get(f"{V}/{job['id']}", headers=headers)).json()
    assert stalled["status"] == "failed" and "too long" in stalled["error"]


async def test_videos_are_private(api, queue):
    owner = await register_user(api)
    job = await create(api, owner)
    other = await register_user(api, email="other@example.com")
    url = f"{V}/{job['id']}"
    assert (await api.get(url, headers=other)).status_code == 404
    assert (await api.post(f"{url}/cancel", headers=other)).status_code == 404
    assert (await api.delete(url, headers=other)).status_code == 404
    assert (await api.get(V, headers=other)).json() == []
