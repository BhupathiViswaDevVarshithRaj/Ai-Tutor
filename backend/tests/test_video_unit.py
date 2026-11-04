"""Unit tests for video scripts, timing, subtitles, storage and signed media links."""

import math
import uuid

import pytest

from app.ai.diagram import compile_surface
from app.ai.llm.base import LLMError
from app.video.geometry3d import bond_angle, bond_directions
from app.video.script import GEOMETRIES, Scene, VideoScript, validate_script
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
        shape="",
        atoms=[],
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


def test_3d_scenes_are_checked_and_normalised():
    script = VideoScript(
        title="Shapes",
        scenes=[  # 8 scenes, the most a script may have; a title card is added in front
            scene(template="model3d", shape="Square Pyramid"),  # normalised
            scene(template="model3d", shape="dodecagon"),  # unknown solid
            scene(template="molecule3d", shape="bent", atoms=["O", "H", "H"]),
            scene(template="molecule3d", shape="tetrahedral", atoms=["C", "H"]),  # 1 of 4 bonds
            scene(template="molecule3d", shape="linear", atoms=["c", "o"]),  # not symbols
            scene(template="surface3d", expression="x^2 - y^2", x_min=-2, x_max=2),
            scene(template="surface3d", expression="x^2 + z"),  # z isn't a variable
            scene(template="summary"),
        ],
    )
    fixed = validate_script(script, "Shapes")
    assert [(s.template, s.shape) for s in fixed.scenes] == [
        ("title", ""),
        ("model3d", "square_pyramid"),
        ("molecule3d", "bent"),
        ("summary", ""),
    ]
    assert fixed.scenes[2].atoms == ["O", "H", "H"]


def test_at_most_two_3d_scenes_are_kept():
    solid = scene(template="model3d", shape="cube")
    fixed = validate_script(
        VideoScript(title="T", scenes=[scene(template="title"), solid, solid, solid, scene()]),
        "T",
    )
    assert [s.template for s in fixed.scenes] == ["title", "model3d", "model3d", "bullets"]


def test_surface_formulas_use_x_and_y_and_plots_only_x():
    surface = scene(template="surface3d", expression="sin(x)*cos(y)", x_min=-3, x_max=3)
    plot = scene(template="plot", expression="x*y")
    fixed = validate_script(
        VideoScript(title="T", scenes=[scene(template="title"), surface, plot, scene()]), "T"
    )
    assert [s.template for s in fixed.scenes] == ["title", "surface3d", "bullets"]
    f = compile_surface("x^2 - y^2")
    assert f(2, 1) == 3 and math.isnan(compile_surface("sqrt(x - y)")(0, 1))


@pytest.mark.parametrize(
    ("written", "kept"),
    [
        ("z = x^2 + y^2", "x^2 + y^2"),
        ("f(x, y) = sin(x)·cos(y)", "sin(x)*cos(y)"),
        ("x² − y²", "x^2 - y^2"),
    ],
)
def test_models_way_of_writing_surfaces_is_accepted(written, kept):
    surface = scene(template="surface3d", expression=written, x_min=-2, x_max=2)
    fixed = validate_script(VideoScript(title="T", scenes=[surface, scene(), scene()]), "T")
    assert fixed.scenes[1].expression == kept


def test_plots_written_as_y_equals_are_accepted():
    plot = scene(template="plot", expression="y = 2*x − 1", x_min=-1, x_max=1)
    fixed = validate_script(VideoScript(title="T", scenes=[plot, scene(), scene()]), "T")
    assert fixed.scenes[1].expression == "2*x - 1"


@pytest.mark.parametrize(
    ("geometry", "angle"),
    [
        ("linear", 180),
        ("bent", 104.5),
        ("trigonal_planar", 120),
        ("trigonal_pyramidal", 107),
        ("tetrahedral", 109.47),
    ],
)
def test_molecule_shapes_have_textbook_bond_angles(geometry, angle):
    assert bond_angle(geometry) == pytest.approx(angle, abs=0.05)


def test_every_geometry_has_unit_bonds_for_its_atom_counts():
    for geometry, counts in GEOMETRIES.items():
        for count in counts:
            directions = bond_directions(geometry, count)
            assert len(directions) == count
            for d in directions:
                assert math.dist(d, (0, 0, 0)) == pytest.approx(1)
    # Octahedral bonds point along ±x, ±y, ±z: all at 90° or 180° to each other.
    octa = bond_directions("octahedral", 6)
    assert {round(sum(a * b for a, b in zip(p, q, strict=True))) for p in octa for q in octa} == {
        -1,
        0,
        1,
    }


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
