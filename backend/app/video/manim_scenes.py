"""Pre-written, parameterised Manim scenes (run by `manim` inside the video worker image).

One scene class reads a JSON description (path in the AITUTOR_SCENE variable) and
draws one of six templates. Nothing in the description is executed: it only supplies text,
dates and a formula checked by the same whitelisted grammar as the whiteboard.
"""

import json
import math
import os
import textwrap
from pathlib import Path

from manim import (
    DOWN,
    LEFT,
    ORIGIN,
    RIGHT,
    UP,
    Arrow,
    Axes,
    Create,
    Dot,
    FadeIn,
    GrowArrow,
    Line,
    RoundedRectangle,
    Scene,
    Text,
    VGroup,
    VMobject,
    Write,
    config,
)

from app.ai.diagram import compile_expression

PAPER = "#FFFDF8"
INK = "#1F1B2D"
MUTED = "#6B6578"
ACCENTS = ["#7C3AED", "#FF7A1A", "#1BA672", "#2B8FD6", "#E5487A", "#C99A00"]
config.background_color = PAPER
MAX_WIDTH = 12.4


def _spec() -> dict:
    return json.loads(Path(os.environ["AITUTOR_SCENE"]).read_text(encoding="utf-8"))


def _text(
    value: str, font: str, size: float, width: int, color: str = INK, weight: str = "NORMAL"
) -> Text:
    wrapped = "\n".join(textwrap.wrap(value, width=width)) or " "
    return Text(wrapped, font=font, font_size=size, color=color, weight=weight, line_spacing=0.9)


def _fit(mob, width: float = MAX_WIDTH, height: float = 6.2):
    if mob.width > width:
        mob.scale_to_fit_width(width)
    if mob.height > height:
        mob.scale_to_fit_height(height)
    return mob


class TemplateScene(Scene):
    def construct(self):
        spec = _spec()
        total = float(spec["seconds"])
        used = getattr(self, f"_{spec['template']}")(spec, spec["font"], total)
        self.wait(max(0.1, total - used))

    # Each builder returns the seconds its animations took.

    def _heading(self, spec, font) -> Text:
        heading = _fit(_text(spec["heading"], font, 40, 34, weight="BOLD"), height=1.4)
        heading.to_edge(UP, buff=0.5)
        underline = Line(LEFT, RIGHT, color=ACCENTS[0], stroke_width=6)
        underline.set_width(min(heading.width, 4)).next_to(heading, DOWN, buff=0.15).align_to(
            heading, LEFT
        )
        self.play(Write(heading), Create(underline), run_time=0.8)
        return heading

    def _title(self, spec, font, total) -> float:
        title = _fit(_text(spec["heading"], font, 60, 22, weight="BOLD"), height=3.2)
        bar = Line(LEFT * 2, RIGHT * 2, color=ACCENTS[1], stroke_width=10).next_to(
            title, DOWN, buff=0.35
        )
        group = VGroup(title, bar)
        if spec.get("caption"):
            caption = _fit(_text(spec["caption"], font, 30, 40, color=MUTED), height=1.2)
            group.add(caption.next_to(bar, DOWN, buff=0.35))
        group.move_to(ORIGIN)
        self.play(Write(title), run_time=1.2)
        self.play(Create(bar), *(FadeIn(m, shift=UP * 0.2) for m in group[2:]), run_time=0.6)
        return 1.8

    def _bullets(self, spec, font, total) -> float:
        heading = self._heading(spec, font)
        rows = VGroup()
        for i, item in enumerate(spec["items"]):
            dot = Dot(radius=0.11, color=ACCENTS[i % len(ACCENTS)])
            label = _text(item, font, 30, 40)
            rows.add(VGroup(dot, label.next_to(dot, RIGHT, buff=0.3)))
        rows.arrange(DOWN, aligned_edge=LEFT, buff=0.45)
        _fit(rows, height=5.0).next_to(heading, DOWN, buff=0.7).to_edge(LEFT, buff=1.2)
        step = min(1.0, max(0.4, total * 0.6 / max(len(rows), 1)))
        for row in rows:
            self.play(FadeIn(row, shift=RIGHT * 0.3), run_time=step)
        return 0.8 + step * len(rows)

    _summary = _bullets

    def _flow(self, spec, font, total) -> float:
        heading = self._heading(spec, font)
        boxes = VGroup()
        for i, item in enumerate(spec["items"]):
            label = _text(item, font, 24, 18)
            box = RoundedRectangle(
                corner_radius=0.2,
                width=max(label.width + 0.5, 2.6),
                height=max(label.height + 0.5, 1.1),
                stroke_color=INK,
                stroke_width=3,
                fill_color=ACCENTS[i % len(ACCENTS)],
                fill_opacity=0.18,
            )
            boxes.add(VGroup(box, label.move_to(box)))
        columns = 3 if len(boxes) > 3 else len(boxes)
        boxes.arrange_in_grid(cols=columns, buff=(1.0, 0.8))
        _fit(boxes, height=5.0).next_to(heading, DOWN, buff=0.8)
        step = min(1.0, max(0.4, total * 0.6 / max(len(boxes), 1)))
        self.play(FadeIn(boxes[0], scale=0.9), run_time=step)
        for prev, box in zip(boxes, boxes[1:], strict=False):
            arrow = Arrow(prev.get_center(), box.get_center(), buff=0.9, color=INK, stroke_width=4)
            self.play(GrowArrow(arrow), FadeIn(box, scale=0.9), run_time=step)
        return 0.8 + step * len(boxes)

    def _plot(self, spec, font, total) -> float:
        heading = self._heading(spec, font)
        f = compile_expression(spec["expression"])
        x0, x1 = spec["x_min"], spec["x_max"]
        xs = [x0 + (x1 - x0) * i / 300 for i in range(301)]
        ys = [f(x) for x in xs]
        finite = sorted(y for y in ys if math.isfinite(y))
        if not finite:
            finite = [-1.0, 1.0]
        lo, hi = finite[int(len(finite) * 0.05)], finite[math.ceil(len(finite) * 0.95) - 1]
        if hi - lo < 1e-9:
            lo, hi = lo - 1, hi + 1
        pad = (hi - lo) * 0.15
        lo, hi = lo - pad, hi + pad
        axes = Axes(
            x_range=[x0, x1, (x1 - x0) / 8],
            y_range=[lo, hi, (hi - lo) / 6],
            x_length=9,
            y_length=4.6,
            axis_config={"color": INK, "include_ticks": True},
            tips=False,
        ).next_to(heading, DOWN, buff=0.5)
        # One polyline per continuous stretch, so asymptotes aren't joined by a vertical line.
        curve = VGroup()
        stretch = []
        for x, y in zip(xs, ys, strict=True):
            if math.isfinite(y) and lo - (hi - lo) <= y <= hi + (hi - lo):
                stretch.append(axes.c2p(x, max(lo, min(hi, y))))
            elif len(stretch) > 1:
                curve.add(VMobject(color=ACCENTS[0], stroke_width=6).set_points_as_corners(stretch))
                stretch = []
            else:
                stretch = []
        if len(stretch) > 1:
            curve.add(VMobject(color=ACCENTS[0], stroke_width=6).set_points_as_corners(stretch))
        self.play(Create(axes), run_time=0.8)
        self.play(Create(curve), run_time=min(2.0, total * 0.4))
        used = 0.8 + 0.8 + min(2.0, total * 0.4)
        if spec.get("caption"):
            caption = _fit(_text(spec["caption"], font, 26, 50, color=MUTED), height=0.9)
            self.play(FadeIn(caption.next_to(axes, DOWN, buff=0.3)), run_time=0.5)
            used += 0.5
        return used

    def _timeline(self, spec, font, total) -> float:
        heading = self._heading(spec, font)
        n = len(spec["items"])
        line = Line(LEFT * 6, RIGHT * 6, color=INK, stroke_width=5).shift(DOWN * 0.6)
        self.play(Create(line), run_time=0.6)
        step = min(1.0, max(0.4, total * 0.6 / max(n, 1)))
        for i, (label, date) in enumerate(zip(spec["items"], spec["dates"], strict=True)):
            x = -5.4 + 10.8 * (i / max(n - 1, 1))
            dot = Dot([x, line.get_y(), 0], radius=0.14, color=ACCENTS[i % len(ACCENTS)])
            when = _text(date, font, 22, 14, color=ACCENTS[i % len(ACCENTS)], weight="BOLD")
            what = _text(label, font, 22, 14)
            card = VGroup(when, what).arrange(DOWN, buff=0.12)
            card.next_to(dot, UP if i % 2 == 0 else DOWN, buff=0.35)
            self.play(
                FadeIn(dot, scale=0.5),
                FadeIn(card, shift=(DOWN if i % 2 == 0 else UP) * 0.2),
                run_time=step,
            )
        _ = heading
        return 0.8 + 0.6 + step * n
