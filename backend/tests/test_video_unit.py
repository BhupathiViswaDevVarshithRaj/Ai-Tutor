"""Unit tests for video scripts, timing, subtitles, storage and signed media links."""

import uuid

import pytest

from app.ai.llm.base import LLMError
from app.video.script import Scene, VideoScript, validate_script
from app.video.storage import LocalMediaStorage, check_media_token, media_token
from app.video.timing import (
    MIN_SCENE_SECONDS,
    TAIL_SECONDS,
    build_cues,
    scene_seconds,
    split_cues,
    to_srt,
    to_vtt,
)


def scene(template="bullets", heading="Heading", narration="Some narration.", **extra) -> Scene:
    base = dict(
        template=template,
        heading=heading,
        items=["One", "Two"],
        dates=[],
        expression="",
        x_min=0,
        x_max=1,
        caption="",
        narration=narration,
    )
    return Scene(**{**base, **extra})


# --- scripts -------------------------------------------------------------------------


def test_a_title_card_is_added_and_bad_scenes_dropped():
    script = VideoScript(
        title="Gravity",
        scenes=[
            scene(),
            scene(template="plot", expression="import os"),  # unsafe formula
            scene(template="plot", expression="x^2", x_min=5, x_max=-5),  # range fixed
            scene(template="timeline", items=["A", "B"], dates=["1900"]),  # dates don't match
            scene(template="flow", items=["only one"]),  # too few steps
            scene(narration="   "),  # nothing to say
            scene(template="summary", items=["Recap", "More"]),
        ],
    )
    fixed = validate_script(script, "Gravity")
    assert [s.template for s in fixed.scenes] == ["title", "bullets", "plot", "summary"]
    assert fixed.scenes[0].heading == "Gravity" and fixed.scenes[0].narration == "Gravity"
    assert (fixed.scenes[2].x_min, fixed.scenes[2].x_max) == (-5, 5)


def test_long_text_is_trimmed():
    fixed = validate_script(
        VideoScript(
            title="T", scenes=[scene(template="title"), scene(items=["x" * 200] * 9), scene()]
        ),
        "T",
    )
    assert len(fixed.scenes[1].items) == 5 and len(fixed.scenes[1].items[0]) == 60


def test_too_few_usable_scenes_is_an_error():
    with pytest.raises(LLMError):
        validate_script(VideoScript(title="T", scenes=[scene(narration="")]), "T")


# --- timing and subtitles -------------------------------------------------------------


def test_scene_length_follows_the_audio_or_the_reading_time():
    assert scene_seconds("x" * 140, None) == 10 + TAIL_SECONDS  # 14 characters a second
    assert scene_seconds("anything", 4200) == 4.2 + TAIL_SECONDS  # real audio length wins
    assert scene_seconds("Hi.", None) == MIN_SCENE_SECONDS


def test_narration_splits_into_readable_cues():
    text = "First sentence here. " + "word " * 40 + "end."
    chunks = split_cues(text, limit=40)
    assert chunks[0] == "First sentence here."
    assert all(len(c) <= 40 for c in chunks)
    assert " ".join(chunks).split() == text.split()
    assert split_cues("पहला वाक्य। दूसरा वाक्य।") == ["पहला वाक्य।", "दूसरा वाक्य।"]


def test_cues_cover_each_scene_in_order():
    cues = build_cues(["One. Two.", "Three."], [5.0, 4.0])
    assert [c.text for c in cues] == ["One.", "Two.", "Three."]
    assert cues[0].start == 0 and cues[2].start == 5.0
    assert cues[1].end == pytest.approx(5.0 - TAIL_SECONDS)
    assert all(a.end <= b.start + 1e-6 for a, b in zip(cues, cues[1:], strict=False))


def test_subtitle_file_formats():
    cues = build_cues(["Hello there."], [3661.5])
    assert to_vtt(cues).startswith("WEBVTT\n\n00:00:00.000 --> 01:01:00.700\nHello there.")
    assert to_srt(cues).startswith("1\n00:00:00,000 --> 01:01:00,700\nHello there.")


# --- storage and signed links ----------------------------------------------------------


def test_storage_keeps_files_inside_its_folder(tmp_path):
    storage = LocalMediaStorage(tmp_path)
    assert storage.put_text("u/videos/j/subs.vtt", "WEBVTT") == 6
    assert (tmp_path / "u/videos/j/subs.vtt").read_text() == "WEBVTT"
    with pytest.raises(ValueError):
        storage.path("../outside.txt")
    storage.delete("u/videos/j/subs.vtt")
    storage.delete("missing.txt")  # deleting twice is fine
    assert not (tmp_path / "u/videos/j/subs.vtt").exists()


def test_media_tokens_are_signed_and_expire():
    asset = uuid.uuid4()
    token = media_token(asset, now=1_000_000)
    assert check_media_token(asset, token, now=1_000_100)
    assert not check_media_token(asset, token, now=1_000_000 + 3600 + 1)  # expired
    assert not check_media_token(uuid.uuid4(), token, now=1_000_100)  # another file
    expires, signature = token.split(".")
    assert not check_media_token(
        asset, f"{int(expires) + 999}.{signature}", now=1_000_100
    )  # tampered
    assert not check_media_token(asset, "nonsense", now=1_000_100)


def test_a_relative_media_root_is_anchored_to_the_repo():
    from pathlib import Path

    from app.core.config import REPO_DIR, Settings

    assert Settings(media_root=Path("media")).media_root == (REPO_DIR / "media").resolve()
    absolute = Path(REPO_DIR.anchor) / "srv" / "media"
    assert Settings(media_root=absolute).media_root == absolute
