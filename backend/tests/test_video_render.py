"""Real rendering (Manim + FFmpeg). Runs only where they're installed, i.e. the worker image:

    docker compose --profile video run --rm --no-deps -v ./backend/tests:/app/tests \\
        video-worker python -m pytest -q tests/test_video_render.py
"""

import json
import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest

from app.video.render import FFmpegCompositor, ManimRenderer
from app.video.script import Scene
from app.video.timing import build_cues, scene_seconds, to_srt

pytestmark = [
    pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="FFmpeg is not installed here"),
    pytest.mark.skipif(
        __import__("importlib").util.find_spec("manim") is None,
        reason="Manim is not installed here",
    ),
]


def scene(template, heading, narration, **extra) -> Scene:
    base = dict(items=[], dates=[], expression="", x_min=0, x_max=1, caption="")
    return Scene(template=template, heading=heading, narration=narration, **{**base, **extra})


SCENES = [
    scene("title", "How plants make food", "Plants make their own food.", caption="Photosynthesis"),
    scene("bullets", "What they need", "They need three things.", items=["Light", "Water", "Air"]),
    scene(
        "flow",
        "The steps",
        "First light, then sugar.",
        items=["Light in", "Water split", "Sugar out"],
    ),
    scene(
        "plot",
        "Growth",
        "Growth speeds up.",
        expression="x^2 - 4",
        x_min=-3,
        x_max=3,
        caption="y = x² − 4",
    ),
    scene(
        "timeline",
        "Discoveries",
        "It took centuries.",
        items=["Helmont", "Priestley"],
        dates=["1640", "1771"],
    ),
    scene("summary", "पौधे भोजन बनाते हैं", "पौधे सूर्य के प्रकाश से भोजन बनाते हैं।", items=["प्रकाश", "पानी"]),
]


def probe(path: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)],
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(out.stdout)


def test_every_template_renders_into_one_subtitled_video():
    workdir = Path(tempfile.mkdtemp())
    renderer, compositor = ManimRenderer("l"), FFmpegCompositor("l")
    durations = [scene_seconds(s.narration, None) for s in SCENES]
    clips = [
        renderer.render(s, seconds, i, workdir, "hi" if i == 5 else "en")
        for i, (s, seconds) in enumerate(zip(SCENES, durations, strict=True))
    ]
    srt = workdir / "subs.srt"
    srt.write_text(to_srt(build_cues([s.narration for s in SCENES], durations)), encoding="utf-8")
    out = workdir / "video.mp4"
    compositor.compose(clips, [None] * len(SCENES), durations, srt, "en", out)

    info = probe(out)
    kinds = sorted(s["codec_type"] for s in info["streams"])
    assert kinds == ["audio", "subtitle", "video"]
    video = next(s for s in info["streams"] if s["codec_type"] == "video")
    assert (video["width"], video["height"]) == (854, 480)
    subtitle = next(s for s in info["streams"] if s["codec_type"] == "subtitle")
    assert subtitle["codec_name"] == "mov_text" and subtitle["tags"]["language"] == "eng"
    assert float(info["format"]["duration"]) == pytest.approx(sum(durations), abs=0.5)
