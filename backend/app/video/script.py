"""Video scripts: what the model writes (scenes + narration) and how it is validated.

The model never writes animation code. Each scene names one of a few pre-written,
parameterised Manim templates (app/video/manim_scenes.py) and supplies its text.
"""

import re
from typing import Literal

from pydantic import BaseModel

from app.ai.diagram import XY, DiagramError, check_expression
from app.ai.llm.base import LLMError
from app.db.enums import LearningLevel

Template = Literal[
    "title",
    "bullets",
    "flow",
    "plot",
    "timeline",
    "summary",
    "model3d",
    "molecule3d",
    "surface3d",
]

# model3d: the solids the renderer can build (and label with their measurements).
SOLIDS = (
    "cube",
    "cuboid",
    "sphere",
    "hemisphere",
    "cylinder",
    "cone",
    "square_pyramid",
    "triangular_prism",
    "tetrahedron",
    "octahedron",
    "torus",
)
# molecule3d: VSEPR shapes -> how many outer atoms each has (a diatomic is linear with 1).
GEOMETRIES = {
    "linear": (1, 2),
    "bent": (2,),
    "trigonal_planar": (3,),
    "trigonal_pyramidal": (3,),
    "tetrahedral": (4,),
    "trigonal_bipyramidal": (5,),
    "octahedral": (6,),
}
ELEMENT = re.compile(r"^[A-Z][a-z]?$")

MIN_SCENES, MAX_SCENES = 3, 8
MAX_3D_SCENES = 2
ITEM_CHARS = 60
HEADING_CHARS = 70
NARRATION_CHARS = 450
# Speaking rate used to size narration to the requested length (without real TTS timings).
CHARS_PER_SECOND = 14


class Scene(BaseModel):
    template: Template
    heading: str
    items: list[str]  # bullets, flow steps, summary points, or timeline events
    dates: list[str]  # timeline only: one date per item
    expression: str  # plot: a formula in x; surface3d: a formula in x and y
    x_min: float  # plot: the x range; surface3d: the range of both x and y
    x_max: float
    shape: str  # model3d: one of SOLIDS; molecule3d: one of GEOMETRIES
    atoms: list[str]  # molecule3d: central atom first, then the outer atoms (symbols)
    caption: str
    narration: str  # what the narrator says during this scene


class VideoScript(BaseModel):
    title: str
    scenes: list[Scene]


def _clean(text: str, limit: int) -> str:
    return " ".join(text.split())[:limit]


# "z = …", "y = …", "f(x) = …", "f(x, y) = …": models often write the left-hand side too.
_LEFT_SIDE = re.compile(r"^\s*(?:[yz]|f\s*\(\s*x\s*(?:,\s*y\s*)?\))\s*=\s*", re.IGNORECASE)
_SYMBOLS = str.maketrans({"·": "*", "×": "*", "−": "-", "–": "-", "²": "^2", "³": "^3"})


def _formula(text: str) -> str:
    """The right-hand side of a formula, with typographic symbols made plain."""
    return _LEFT_SIDE.sub("", text.translate(_SYMBOLS)).strip()


def _scene(s: Scene) -> Scene | None:
    narration = _clean(s.narration, NARRATION_CHARS)
    heading = _clean(s.heading, HEADING_CHARS)
    if not narration or not heading:
        return None
    limit = {
        "bullets": 5,
        "flow": 6,
        "summary": 5,
        "timeline": 6,
        "model3d": 4,
        "molecule3d": 4,
        "surface3d": 3,
    }.get(s.template, 0)
    items = [i for i in (_clean(x, ITEM_CHARS) for x in s.items[:limit]) if i]
    dates: list[str] = []
    expression, x_min, x_max = "", 0.0, 1.0
    shape, atoms = "", []
    if s.template in ("bullets", "flow", "summary") and len(items) < 2:
        return None
    if s.template == "timeline":
        dates = [_clean(d, 20) for d in s.dates[: len(items)]]
        if len(items) < 2 or len(dates) != len(items):
            return None
    if s.template == "plot":
        expression = _formula(s.expression)
        try:
            check_expression(expression)
        except DiagramError:
            return None
        x_min, x_max = (
            (s.x_min, s.x_max) if s.x_min < s.x_max and s.x_max - s.x_min <= 1e3 else (-5.0, 5.0)
        )
    if s.template == "surface3d":
        expression = _formula(s.expression)
        try:
            check_expression(expression, XY)
        except DiagramError:
            return None
        x_min, x_max = (
            (s.x_min, s.x_max) if s.x_min < s.x_max and s.x_max - s.x_min <= 40 else (-3.0, 3.0)
        )
    if s.template in ("model3d", "molecule3d"):
        shape = s.shape.strip().lower().replace(" ", "_").replace("-", "_")
    if s.template == "model3d" and shape not in SOLIDS:
        return None
    if s.template == "molecule3d":
        atoms = [a.strip() for a in s.atoms]
        if (
            shape not in GEOMETRIES
            or len(atoms) - 1 not in GEOMETRIES[shape]
            or not all(ELEMENT.match(a) for a in atoms)
        ):
            return None
    return Scene(
        template=s.template,
        heading=heading,
        items=items,
        dates=dates,
        expression=expression,
        x_min=x_min,
        x_max=x_max,
        shape=shape,
        atoms=atoms,
        caption=_clean(s.caption, 120),
        narration=narration,
    )


def validate_script(script: VideoScript, topic: str) -> VideoScript:
    """Repair model output: drop unusable scenes, open with a title card, cap the length."""
    scenes = [s for s in (_scene(x) for x in script.scenes[:MAX_SCENES]) if s]
    # 3D scenes take ~1-1.5 min each to render at 720p: keep the first MAX_3D_SCENES.
    three_d = [i for i, s in enumerate(scenes) if s.template.endswith("3d")]
    scenes = [s for i, s in enumerate(scenes) if i not in three_d[MAX_3D_SCENES:]]
    title = _clean(script.title, HEADING_CHARS) or _clean(topic, HEADING_CHARS)
    if scenes and scenes[0].template != "title":
        intro = Scene(
            template="title",
            heading=title,
            items=[],
            dates=[],
            expression="",
            x_min=0,
            x_max=1,
            shape="",
            atoms=[],
            caption="",
            narration=title,
        )
        scenes = [intro, *scenes][:MAX_SCENES]
    if len(scenes) < MIN_SCENES:
        raise LLMError("The video script couldn't be prepared. Please try again.")
    return VideoScript(title=title, scenes=scenes)


VIDEO_SYSTEM = (
    "You write scripts for short explainer videos (30-120 seconds) in a learning app. A video "
    "is 3-8 scenes. Each scene uses one template:\n"
    "- title: the opening card (heading = video title, caption = one-line hook). Use it first.\n"
    "- bullets: a heading and 2-5 short points.\n"
    "- flow: a heading and 2-6 steps that happen in order.\n"
    "- plot: a heading, a formula in x (numbers, x, + - * / ^, parentheses, sin cos tan sqrt "
    "abs log ln exp, pi, e; write multiplication explicitly: 2*x; only the right-hand side, "
    "e.g. x^2 - 4, not y = x^2 - 4), x_min/x_max, and a caption.\n"
    "- timeline: a heading and 2-6 events, with one date per event in `dates`.\n"
    "- summary: the closing scene with 2-5 key takeaways.\n"
    "3D templates (the object turns slowly so the learner sees every side; use one whenever "
    "the topic has a shape, a structure in space or a function of two variables):\n"
    f"- model3d: a solid; `shape` is one of {', '.join(SOLIDS)}. `items` = 2-4 short facts "
    "shown beside it one by one (e.g. 'Volume = pi*r^2*h', '2 flat faces').\n"
    "- molecule3d: a ball-and-stick molecule; `shape` is its VSEPR geometry, one of "
    f"{', '.join(GEOMETRIES)}; `atoms` = element symbols, central atom first, then the outer "
    "atoms (H2O: bent, ['O','H','H']; CH4: tetrahedral, ['C','H','H','H','H']; CO2: linear, "
    "['C','O','O']). `items` = 2-4 facts (e.g. 'Bond angle 104.5°').\n"
    "- surface3d: a 3D graph z = f(x, y); `expression` is a formula in x and y (same rules as "
    "plot, e.g. x^2 - y^2 or sin(x)*cos(y), not z = ...), x_min/x_max the range of both x and "
    "y (e.g. -3 to 3); `items` = up to 3 short notes.\n"
    "On-screen text is short (items ≤ 8 words). `narration` is what the narrator says during "
    "the scene: natural spoken sentences that explain, not read, the screen. Size the total "
    "narration to the requested length at about 14 characters per second. Write everything in "
    "the requested language at the stated level. Leave fields a template doesn't use empty "
    "(x range 0 to 1, shape '', atoms [])."
)


def video_request(
    *, topic: str, level: LearningLevel, language_name: str, seconds: int, plan: dict | None
) -> str:
    import json

    lines = [
        f"Topic: {topic}",
        f"Level: {level.value}",
        f"Language: {language_name}",
        f"Length: about {seconds} seconds "
        f"(about {seconds * CHARS_PER_SECOND} characters of narration)",
    ]
    if plan:
        lines.append(
            "It is for this lesson:\n" + json.dumps(plan, ensure_ascii=False, sort_keys=True)
        )
    lines.append("Write the video script.")
    return "\n".join(lines)
