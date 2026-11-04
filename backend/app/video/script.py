"""Video scripts: what the model writes (scenes + narration) and how it is validated.

The model never writes animation code. Each scene names one of a few pre-written,
parameterised Manim templates (app/video/manim_scenes.py) and supplies its text.
"""

from typing import Literal

from pydantic import BaseModel

from app.ai.diagram import DiagramError, check_expression
from app.ai.llm.base import LLMError
from app.db.enums import LearningLevel

Template = Literal["title", "bullets", "flow", "plot", "timeline", "summary"]

MIN_SCENES, MAX_SCENES = 3, 8
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
    expression: str  # plot only: a formula in x
    x_min: float
    x_max: float
    caption: str
    narration: str  # what the narrator says during this scene


class VideoScript(BaseModel):
    title: str
    scenes: list[Scene]


def _clean(text: str, limit: int) -> str:
    return " ".join(text.split())[:limit]


def _scene(s: Scene) -> Scene | None:
    narration = _clean(s.narration, NARRATION_CHARS)
    heading = _clean(s.heading, HEADING_CHARS)
    if not narration or not heading:
        return None
    limit = {"bullets": 5, "flow": 6, "summary": 5, "timeline": 6}.get(s.template, 0)
    items = [i for i in (_clean(x, ITEM_CHARS) for x in s.items[:limit]) if i]
    dates: list[str] = []
    expression, x_min, x_max = "", 0.0, 1.0
    if s.template in ("bullets", "flow", "summary") and len(items) < 2:
        return None
    if s.template == "timeline":
        dates = [_clean(d, 20) for d in s.dates[: len(items)]]
        if len(items) < 2 or len(dates) != len(items):
            return None
    if s.template == "plot":
        try:
            check_expression(s.expression)
        except DiagramError:
            return None
        expression = s.expression.strip()
        x_min, x_max = (
            (s.x_min, s.x_max) if s.x_min < s.x_max and s.x_max - s.x_min <= 1e3 else (-5.0, 5.0)
        )
    return Scene(
        template=s.template,
        heading=heading,
        items=items,
        dates=dates,
        expression=expression,
        x_min=x_min,
        x_max=x_max,
        caption=_clean(s.caption, 120),
        narration=narration,
    )


def validate_script(script: VideoScript, topic: str) -> VideoScript:
    """Repair model output: drop unusable scenes, open with a title card, cap the length."""
    scenes = [s for s in (_scene(x) for x in script.scenes[:MAX_SCENES]) if s]
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
    "abs log ln exp, pi, e; write multiplication explicitly: 2*x), x_min/x_max, and a caption.\n"
    "- timeline: a heading and 2-6 events, with one date per event in `dates`.\n"
    "- summary: the closing scene with 2-5 key takeaways.\n"
    "On-screen text is short (items ≤ 8 words). `narration` is what the narrator says during "
    "the scene: natural spoken sentences that explain, not read, the screen. Size the total "
    "narration to the requested length at about 14 characters per second. Write everything in "
    "the requested language at the stated level. Leave fields a template doesn't use empty "
    "(x range 0 to 1)."
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
