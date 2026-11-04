"""Pre-written, parameterised Manim scenes (run by `manim` inside the video worker image).

Two scene classes read a JSON description (path in the AITUTOR_SCENE variable):
`TemplateScene` draws the 2D templates and `Template3DScene` the 3D ones (solids, molecules,
surfaces). Nothing in the description is executed: it only supplies text, dates, a shape name,
element symbols and formulas checked by the same whitelisted grammar as the whiteboard.
"""

import json
import math
import os
import textwrap
from pathlib import Path

import numpy as np
from manim import (
    DEGREES,
    DOWN,
    LEFT,
    ORIGIN,
    OUT,
    RIGHT,
    UP,
    Arrow,
    Axes,
    Cone,
    Create,
    Cube,
    Cylinder,
    DashedLine,
    Dot,
    FadeIn,
    GrowArrow,
    Line,
    Line3D,
    Octahedron,
    Polyhedron,
    Prism,
    RoundedRectangle,
    Scene,
    Sphere,
    Surface,
    Tetrahedron,
    Text,
    ThreeDAxes,
    ThreeDScene,
    Torus,
    VGroup,
    VMobject,
    Write,
    config,
)

from app.ai.diagram import compile_expression, compile_surface
from app.video.geometry3d import bond_directions, element_style

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


# --- 3D -------------------------------------------------------------------------------

# One full turn of the model every TURN_SECONDS, so every side is seen in a normal scene.
TURN_SECONDS = 14
SOLID_STYLE = {"fill_opacity": 0.82, "stroke_color": INK, "stroke_width": 1.5}


def _polyhedron(cls, *args, color: str, **kwargs):
    body = cls(*args, faces_config={"fill_color": color, "fill_opacity": 0.8}, **kwargs)
    body.graph.set_opacity(0)  # faces only, no vertex dots
    return body


def _solid(shape: str):
    """The model for `shape` (about 3 units tall) and its measurement lines with labels."""
    color = ACCENTS[0]
    dims: list[tuple] = []  # (start, end, label, dashed)
    if shape == "cube":
        body = Cube(side_length=2.6, fill_color=color, **SOLID_STYLE)
        dims.append(((-1.3, -1.3, -1.3), (1.3, -1.3, -1.3), "a", False))
    elif shape == "cuboid":
        body = Prism(dimensions=[3.4, 2.0, 1.8], fill_color=color, **SOLID_STYLE)
        dims += [
            ((-1.7, -1.0, -0.9), (1.7, -1.0, -0.9), "l", False),
            ((1.7, -1.0, -0.9), (1.7, 1.0, -0.9), "w", False),
            ((1.7, -1.0, -0.9), (1.7, -1.0, 0.9), "h", False),
        ]
    elif shape in ("sphere", "hemisphere"):
        v_range = (0, math.pi / 2) if shape == "hemisphere" else (0, math.pi)
        body = Sphere(radius=1.6, resolution=(18, 36), v_range=v_range)
        body.set_fill(color, opacity=0.78).set_stroke(INK, width=0.4)
        dims.append(((0, 0, 0), (1.6, 0, 0), "r", False))
    elif shape == "cylinder":
        body = Cylinder(radius=1.2, height=2.8, resolution=(12, 36))
        body.set_fill(color, opacity=0.8).set_stroke(INK, width=0.4)
        dims += [
            ((0, 0, 1.4), (1.2, 0, 1.4), "r", False),
            ((1.5, 0, -1.4), (1.5, 0, 1.4), "h", True),
        ]
    elif shape == "cone":
        body = Cone(base_radius=1.4, height=2.8, show_base=True, resolution=(12, 36))
        body.set_fill(color, opacity=0.8).set_stroke(INK, width=0.4)
        body.move_to(ORIGIN)
        # Measure from the base: the wide end is the one with points far from the axis.
        pts = body.get_all_points()
        top, bottom = pts[:, 2].max(), pts[:, 2].min()
        wide_at_top = np.abs(pts[pts[:, 2] > top - 0.05][:, :2]).max() > 0.5
        base_z, tip_z = (top, bottom) if wide_at_top else (bottom, top)
        dims += [
            ((0, 0, base_z), (1.4, 0, base_z), "r", False),
            ((0, 0, base_z), (0, 0, tip_z), "h", True),
            ((1.4, 0, base_z), (0, 0, tip_z), "l", False),
        ]
    elif shape == "square_pyramid":
        s, h = 1.4, 2.6
        verts = [(-s, -s, -h / 2), (s, -s, -h / 2), (s, s, -h / 2), (-s, s, -h / 2), (0, 0, h / 2)]
        faces = [[0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]]
        body = _polyhedron(Polyhedron, verts, faces, color=color)
        dims += [
            ((-s, -s, -h / 2), (s, -s, -h / 2), "a", False),
            ((0, 0, -h / 2), (0, 0, h / 2), "h", True),
        ]
    elif shape == "triangular_prism":
        r, h = 1.5, 2.8
        angles = (math.pi / 2, math.pi * 7 / 6, math.pi * 11 / 6)
        tri = [(r * math.cos(a), r * math.sin(a)) for a in angles]
        verts = [(x, y, -h / 2) for x, y in tri] + [(x, y, h / 2) for x, y in tri]
        faces = [[0, 1, 2], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]]
        body = _polyhedron(Polyhedron, verts, faces, color=color)
        x, y = tri[1]
        dims.append(((x, y, -h / 2), (x, y, h / 2), "h", False))
    elif shape in ("tetrahedron", "octahedron"):
        if shape == "tetrahedron":
            body = _polyhedron(Tetrahedron, edge_length=2.8, color=color)
        else:
            body = _polyhedron(Octahedron, edge_length=2.4, color=color)
        a, b = body.vertex_coords[0], body.vertex_coords[1]
        dims.append((tuple(a), tuple(b), "a", False))
    else:  # torus
        body = Torus(major_radius=1.7, minor_radius=0.6, resolution=(18, 36))
        body.set_fill(color, opacity=0.8).set_stroke(INK, width=0.3)
        dims += [((0, 0, 0), (1.7, 0, 0), "R", False), ((1.7, 0, 0), (2.3, 0, 0), "r", False)]

    lines, anchors = VGroup(), VGroup()
    labels = []
    for start, end, label, dashed in dims:
        a, b = np.array(start, dtype=float), np.array(end, dtype=float)
        kind = DashedLine if dashed else Line
        lines.add(kind(a, b, color=ACCENTS[1], stroke_width=6))
        # The label sits just outside the line, away from the solid's axis (or to one side of
        # a line on the axis), on an invisible point that turns with the model.
        mid = (a + b) / 2
        outward = np.array([mid[0], mid[1], 0.0])
        length = np.linalg.norm(outward)
        outward = outward / length if length > 0.2 else np.array([-1.0, 0.0, 0.0])
        anchor = Dot(mid + outward * 0.38, radius=0.01).set_opacity(0)
        anchors.add(anchor)
        labels.append((anchor, label))
    return body, VGroup(lines, anchors), labels


def _is_dark(hex_color: str) -> bool:
    r, g, b = (int(hex_color[i : i + 2], 16) / 255 for i in (1, 3, 5))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.45


def _molecule(geometry: str, atoms: list[str]):
    """Ball-and-stick model: atoms (spheres) and bonds (rods) around the central atom."""
    bond = 2.3
    directions = bond_directions(geometry, len(atoms) - 1)
    positions = [np.zeros(3)] + [np.array(d) * bond for d in directions]
    rods = VGroup(
        *(
            Line3D(positions[0], p, thickness=0.07, color="#8A8494", resolution=8)
            for p in positions[1:]
        )
    )
    balls = VGroup()
    for symbol, pos in zip(atoms, positions, strict=True):
        color, radius = element_style(symbol)
        ball = Sphere(center=pos, radius=radius * 1.25, resolution=(10, 18))
        ball.set_fill(color, opacity=1).set_stroke(width=0)
        balls.add(ball)
    return balls, rods


class Template3DScene(ThreeDScene):
    """Solids, molecules and surfaces that turn slowly, with a flat heading and fact list."""

    def construct(self):
        spec = _spec()
        total = float(spec["seconds"])
        font = spec["font"]
        self.set_camera_orientation(phi=68 * DEGREES, theta=-50 * DEGREES)
        heading = _fit(_text(spec["heading"], font, 38, 36, weight="BOLD"), height=1.2)
        heading.to_edge(UP, buff=0.4)
        self.add_fixed_in_frame_mobjects(heading)
        self.play(Write(heading), run_time=0.8)
        used = 0.8 + getattr(self, f"_{spec['template']}")(spec, font, total - 0.8)
        self.wait(max(0.1, total - used))

    # --- helpers

    def _screen_left(self, amount: float) -> np.ndarray:
        """A world-space offset that appears `amount` units to the left on screen."""
        rotation = self.camera.generate_rotation_matrix()
        return rotation.T @ (LEFT * amount)

    def _turn(self, mob, centre) -> None:
        """Keep `mob` turning about the vertical axis through `centre` for the rest of the scene."""
        rate = 2 * math.pi / TURN_SECONDS
        # Its parts were animated in one by one; the updater only runs on what is in the
        # scene, so swap the separate parts for the whole group.
        self.remove(*mob.get_family())
        self.add(mob)
        mob.add_updater(lambda m, dt: m.rotate(rate * dt, axis=OUT, about_point=centre))

    def _label(
        self, text: str, font: str, follow, offset=OUT * 0.35, size: float = 30, color: str = INK
    ):
        """A label that faces the camera and follows `follow()` (a point that moves)."""
        label = Text(text, font=font, font_size=size, color=color, weight="BOLD")
        label.move_to(follow() + offset)
        label.add_updater(lambda m: m.move_to(follow() + offset))
        self.add_fixed_orientation_mobjects(label)
        return label

    def _facts(self, spec, font, budget: float) -> float:
        """The scene's items, appearing one by one on the right; returns seconds used."""
        items = spec["items"]
        if not items:
            return 0.0
        rows = VGroup()
        for i, item in enumerate(items):
            dot = Dot(radius=0.09, color=ACCENTS[(i + 1) % len(ACCENTS)])
            label = _text(item, font, 26, 24)
            rows.add(VGroup(dot, label.next_to(dot, RIGHT, buff=0.25)))
        rows.arrange(DOWN, aligned_edge=LEFT, buff=0.4)
        _fit(rows, width=5.4, height=4.8).to_edge(RIGHT, buff=0.6).shift(DOWN * 0.4)
        step = min(1.0, max(0.4, budget * 0.5 / len(rows)))
        gap = max(0.0, budget * 0.6 / len(rows) - step)
        for row in rows:
            self.add_fixed_in_frame_mobjects(row)
            self.play(FadeIn(row, shift=LEFT * 0.2), run_time=step)
            if gap:
                self.wait(gap)
        return (step + gap) * len(rows)

    def _place(self, spec) -> np.ndarray:
        """Where the model goes: left of centre when facts share the screen."""
        return self._screen_left(2.9) if spec["items"] else np.zeros(3)

    # --- templates (each returns the seconds its animations took)

    def _model3d(self, spec, font, budget) -> float:
        body, lines, dims = _solid(spec["shape"])
        model = VGroup(body, lines)
        centre = self._place(spec)
        model.shift(centre)
        self.play(Create(body), run_time=1.6)
        self.play(Create(lines[0]), run_time=0.8)
        self._turn(model, centre)
        for anchor, text in dims:
            self._label(text, font, anchor.get_center, offset=ORIGIN)
        return 2.4 + self._facts(spec, font, budget - 2.4)

    def _molecule3d(self, spec, font, budget) -> float:
        balls, rods = _molecule(spec["shape"], spec["atoms"])
        model = VGroup(rods, balls)
        centre = self._place(spec)
        model.shift(centre)
        self.play(FadeIn(balls[0], scale=0.5), run_time=0.6)
        self.play(Create(rods), *(FadeIn(b, scale=0.5) for b in balls[1:]), run_time=1.4)
        self._turn(model, centre)
        for ball, symbol in zip(balls, spec["atoms"], strict=True):
            # Light text on dark atoms (carbon, nitrogen, ...), dark text on light ones.
            ink = PAPER if _is_dark(element_style(symbol)[0]) else INK
            self._label(symbol, font, ball.get_center, offset=ORIGIN, size=26, color=ink)
        return 2.0 + self._facts(spec, font, budget - 2.0)

    def _surface3d(self, spec, font, budget) -> float:
        f = compile_surface(spec["expression"])
        lo, hi = spec["x_min"], spec["x_max"]
        n = 24
        grid = [lo + (hi - lo) * i / n for i in range(n + 1)]
        values = sorted(z for x in grid for y in grid if math.isfinite(z := f(x, y)))
        if not values:
            values = [-1.0, 1.0]
        z_lo, z_hi = values[int(len(values) * 0.03)], values[math.ceil(len(values) * 0.97) - 1]
        if z_hi - z_lo < 1e-9:
            z_lo, z_hi = z_lo - 1, z_hi + 1
        axes = ThreeDAxes(
            x_range=[lo, hi, (hi - lo) / 4],
            y_range=[lo, hi, (hi - lo) / 4],
            z_range=[z_lo, z_hi, (z_hi - z_lo) / 4],
            x_length=4.6,
            y_length=4.6,
            z_length=3.0,
            axis_config={"color": INK, "include_ticks": False},
        )

        def point(u, v):
            z = f(u, v)
            z = z_lo if not math.isfinite(z) else max(z_lo, min(z_hi, z))
            return axes.c2p(u, v, z)

        surface = Surface(point, u_range=[lo, hi], v_range=[lo, hi], resolution=(n, n))
        surface.set_style(stroke_color=INK, stroke_width=0.3)
        surface.set_fill_by_checkerboard(ACCENTS[0], ACCENTS[3], opacity=0.85)
        model = VGroup(axes, surface)
        centre = self._place(spec)
        model.move_to(centre)
        self.play(Create(axes), run_time=0.8)
        self.play(Create(surface), run_time=1.8)
        self._turn(model, centre)
        formula = _fit(_text(f"z = {spec['expression']}", font, 28, 40, color=MUTED), height=0.7)
        formula.to_edge(DOWN, buff=0.4)
        self.add_fixed_in_frame_mobjects(formula)
        self.play(FadeIn(formula), run_time=0.5)
        return 3.1 + self._facts(spec, font, budget - 3.1)
