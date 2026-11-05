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
from PIL import Image

from app.video.images import FoundImage
from app.video.render import FFmpegCompositor, ManimRenderer
from app.video.script import MapBranch, Scene
from app.video.timing import build_cues, scene_seconds, to_srt

pytestmark = [
    pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="FFmpeg is not installed here"),
    pytest.mark.skipif(
        __import__("importlib").util.find_spec("manim") is None,
        reason="Manim is not installed here",
    ),
]


def scene(template, heading, narration, **extra) -> Scene:
    base = dict(
        items=[],
        dates=[],
        expression="",
        x_min=0,
        x_max=1,
        shape="",
        atoms=[],
        image_query="",
        caption="",
    )
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
    scene("model3d", "A leaf cell", "Cells are boxes.", shape="cuboid", items=["Cell wall"]),
    scene("molecule3d", "Water", "Water is bent.", shape="bent", atoms=["O", "H", "H"]),
    scene(
        "surface3d",
        "Light on a leaf",
        "Brightest in the middle.",
        expression="exp(-(x^2 + y^2))",
        x_min=-2,
        x_max=2,
    ),
    scene(
        "mindmap",
        "How it fits together",
        "An overview. Light first. Then water. Then air.",
        caption="Photosynthesis",
        branches=[
            MapBranch(label="Light", children=["From the sun", "Absorbed"], say="Light first."),
            MapBranch(label="Water", children=["From the roots"], say="Then water."),
            MapBranch(label="Air", children=[], say="Then air."),
        ],
    ),
    scene("cycle", "The carbon cycle", "Carbon loops.", items=["Air", "Leaf", "Soil"]),
    scene(
        "compare",
        "Day and night",
        "They differ.",
        branches=[
            MapBranch(label="Day", children=["Light", "Makes sugar"], say=""),
            MapBranch(label="Night", children=["Dark", "Uses sugar"], say=""),
        ],
    ),
    scene(
        "chart",
        "Leaf sizes",
        "Some leaves are big.",
        items=["Fern", "Oak", "Palm"],
        values=[4.0, 12.5, 300.0],
        caption="Length in centimetres",
    ),
    scene(
        "image", "A leaf up close", "This is a leaf.", image_query="leaf", items=["Green", "Flat"]
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
    # A picture as the pipeline saves them (RGBA PNG): this also guards the Pillow pin.
    picture = workdir / "leaf.png"
    Image.new("RGBA", (900, 600), (60, 160, 60, 255)).save(picture)
    leaf = FoundImage(picture, "File:Leaf.png", "Image: Test · CC0 · Wikimedia Commons", "")
    clips = [
        renderer.render(
            s,
            seconds,
            i,
            workdir,
            "hi" if s.template == "summary" else "en",
            leaf if s.template == "image" else None,
        )
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
