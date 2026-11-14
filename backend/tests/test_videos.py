"""Videos: the API (queue, status, cancel, delete, signed media) and the pipeline (fake render)."""

import asyncio
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import select, update

from app.ai.llm.base import LLMRefusal, ParseResult
from app.ai.llm.mock_provider import MockLLMProvider
from app.ai.speech.base import AudioResult
from app.ai.speech.mock import MockTTSProvider
from app.core.config import get_settings
from app.db.enums import VideoStatus
from app.db.models import MediaAsset, MediaBlob, VideoJob
from app.db.session import session_scope
from app.services.video_service import get_video_queue
from app.video.images import FoundImage
from app.video.pipeline import RenderError, VideoDeps, run_video_job
from app.video.script import Scene, VideoScript
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
        self.images: dict[int, object] = {}
        self.on_render = on_render
        self.fail_at = fail_at

    def render(self, scene, seconds, index, workdir: Path, language, image=None):
        if image:
            self.images[index] = image
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


def deps(renderer=None, tts=None, llm=None, images=None):
    return VideoDeps(
        llm=llm or MockLLMProvider(),
        tts=tts or MockTTSProvider(),
        renderer=renderer or FakeRenderer(),
        compositor=FakeCompositor(),
        storage=get_storage(),
        images=images,
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
    assert done["title"] == "Photosynthesis (mock video)" and done["scene_count"] == 6
    # The mock voice is tones, not speech: the video is silent with subtitles.
    assert done["narrated"] is False
    assert [t for t, _, _ in renderer.calls] == [
        "title",
        "bullets",
        "flow",
        "model3d",
        "mindmap",
        "summary",
    ]
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


# --- pictures -------------------------------------------------------------------------


def picture_scene(heading, query, items):
    return Scene(
        template="image",
        heading=heading,
        items=items,
        dates=[],
        expression="",
        x_min=0,
        x_max=1,
        shape="",
        atoms=[],
        image_query=query,
        caption="",
        narration=f"About {heading}.",
    )


class ScriptLLM(MockLLMProvider):
    """Writes a fixed script with two picture scenes."""

    async def parse(self, *, system, messages, schema, role="structured"):
        script = VideoScript(
            title="The AK-47",
            scenes=[
                picture_scene("The rifle", "AK-47 rifle", ["Designed in 1947", "Gas-operated"]),
                picture_scene("Its inventor", "nothing matches this", ["Kalashnikov", "Engineer"]),
                picture_scene("A detail", "no result either", []),
            ],
        )
        return ParseResult(value=script, model="test")


class FakeImages:
    def __init__(self) -> None:
        self.queries: list[str] = []

    async def find(self, query, dest):
        self.queries.append(query)
        if query != "AK-47 rifle":
            return None
        dest.write_bytes(b"png")
        return FoundImage(
            path=dest,
            title="File:AK-47 assault rifle.jpg",
            credit="Image: Ickybicky · Public domain · Wikimedia Commons",
            source_url="https://commons.wikimedia.org/wiki/File:AK-47_assault_rifle.jpg",
        )


async def test_picture_scenes_get_real_pictures_or_fall_back_to_text(api, queue):
    headers = await register_user(api)
    job = await create(api, headers)
    renderer, images = FakeRenderer(), FakeImages()
    await run_video_job(uuid.UUID(job["id"]), deps(renderer, llm=ScriptLLM(), images=images))

    done = (await api.get(f"{V}/{job['id']}", headers=headers)).json()
    assert done["status"] == "completed", done
    assert images.queries == ["AK-47 rifle", "nothing matches this", "no result either"]
    # Scene 0 is the title card; the found picture goes to scene 1. Without a picture, a scene
    # with facts becomes bullets and one without becomes a plain card.
    assert [t for t, _, _ in renderer.calls] == ["title", "image", "bullets", "title"]
    assert list(renderer.images) == [1]
    assert done["image_credits"] == [
        {
            "scene": 1,
            "title": "File:AK-47 assault rifle.jpg",
            "credit": "Image: Ickybicky · Public domain · Wikimedia Commons",
            "source_url": "https://commons.wikimedia.org/wiki/File:AK-47_assault_rifle.jpg",
        }
    ]


async def test_without_a_picture_finder_picture_scenes_become_text(api, queue):
    headers = await register_user(api)
    job = await create(api, headers)
    renderer = FakeRenderer()
    await run_video_job(uuid.UUID(job["id"]), deps(renderer, llm=ScriptLLM()))
    done = (await api.get(f"{V}/{job['id']}", headers=headers)).json()
    assert [t for t, _, _ in renderer.calls] == ["title", "bullets", "bullets", "title"]
    assert done["image_credits"] == []


async def test_database_storage_serves_and_deletes_files(api, queue, monkeypatch):
    # MEDIA_STORAGE=database: what Render uses, where the worker can't share a disk with the API.
    monkeypatch.setattr(get_settings(), "media_storage", "database")
    headers = await register_user(api)
    job = await create(api, headers)
    await run_video_job(uuid.UUID(job["id"]), deps())
    done = (await api.get(f"{V}/{job['id']}", headers=headers)).json()
    assert done["status"] == "completed"
    async with session_scope() as session:
        keys = list(await session.scalars(select(MediaAsset.storage_key)))
        blobs = list(await session.scalars(select(MediaBlob.key)))
    assert sorted(keys) == sorted(blobs)
    assert not any((get_settings().media_root / k).exists() for k in keys)

    video = await api.get(done["video_url"])
    assert video.status_code == 200 and video.headers["content-type"] == "video/mp4"
    assert video.content.startswith(b"\x00\x00\x00\x18ftypmp42") and len(video.content) == 5012
    part = await api.get(done["video_url"], headers={"Range": "bytes=10-19"})
    assert part.status_code == 206 and part.content == video.content[10:20]
    assert part.headers["content-range"] == "bytes 10-19/5012"
    tail = await api.get(done["video_url"], headers={"Range": "bytes=-12"})
    assert tail.status_code == 206 and tail.content == video.content[-12:]
    open_end = await api.get(done["video_url"], headers={"Range": "bytes=5000-"})
    assert open_end.content == video.content[5000:]
    too_far = await api.get(done["video_url"], headers={"Range": "bytes=9000-"})
    assert too_far.status_code == 416
    vtt = await api.get(done["subtitles_url"])
    assert vtt.text.startswith("WEBVTT")

    assert (await api.delete(f"{V}/{job['id']}", headers=headers)).status_code == 204
    async with session_scope() as session:
        assert list(await session.scalars(select(MediaBlob))) == []
