"""Diagrams: structured output schema, a safe function-expression checker, and validation.

The model describes a diagram (what's in it and in what order to reveal it); the app lays it
out. Function graphs use a small whitelisted expression grammar, never `eval`, and the same
grammar is implemented in the frontend renderer.
"""

import math
import re
from typing import Literal

from pydantic import BaseModel

from app.ai.llm.base import LLMError

DiagramType = Literal["flowchart", "block", "timeline", "graph_fn", "process"]
ElementKind = Literal["box", "decision", "start_end", "note", "event"]

MAX_ELEMENTS = 24
MAX_CONNECTORS = 40
MAX_STEPS = 10
MAX_FUNCTIONS = 4
MAX_POINTS = 10
LABEL_CHARS = 60
TAG_CHARS = 30
TEXT_CHARS = 300


class Element(BaseModel):
    id: str
    kind: ElementKind
    label: str
    tag: str  # short extra text: a date on a timeline, a value; may be empty
    detail: str  # one-sentence explanation; may be empty


class Connector(BaseModel):
    id: str
    source: str
    target: str
    label: str


class PlotFunction(BaseModel):
    id: str
    expression: str  # in x, e.g. "x^2 - 2*x + 1" or "sin(x)"
    label: str


class PlotPoint(BaseModel):
    id: str
    x: float
    y: float
    label: str


class Step(BaseModel):
    title: str
    explanation: str
    show: list[str]  # ids of elements, connectors, functions or points revealed in this step


class DiagramSpec(BaseModel):
    title: str
    diagram_type: DiagramType
    elements: list[Element]
    connectors: list[Connector]
    functions: list[PlotFunction]
    points: list[PlotPoint]
    x_min: float
    x_max: float
    x_label: str
    y_label: str
    steps: list[Step]


class DiagramError(ValueError):
    """A diagram can't be used; the message says why."""


# --- safe expressions --------------------------------------------------------------

FUNCTIONS = {"sin", "cos", "tan", "sqrt", "abs", "log", "ln", "exp"}
CONSTANTS = {"pi", "e"}
_TOKEN = re.compile(r"\s*(?:(\d+(?:\.\d+)?|\.\d+)|([A-Za-z]+)|(\*\*|[-+*/^(),]))")


def tokenize(expression: str) -> list[str]:
    tokens, pos = [], 0
    text = expression.strip()
    while pos < len(text):
        match = _TOKEN.match(text, pos)
        if not match or match.end() == pos:
            raise DiagramError(f"Unexpected character in '{expression}'.")
        number, name, op = match.groups()
        token = number or (name.lower() if name else None) or op
        if name and token not in FUNCTIONS | CONSTANTS | {"x"}:
            raise DiagramError(f"'{name}' isn't allowed in a formula.")
        tokens.append("^" if token == "**" else token)
        pos = match.end()
    if not tokens:
        raise DiagramError("A function needs a formula.")
    return tokens


def parse_expression(expression: str) -> tuple:
    """Parse a formula in x into a small tree, or raise DiagramError (grammar below).

    expr := term (('+'|'-') term)* ; term := unary (('*'|'/') unary)* ;
    unary := ('+'|'-') unary | power ; power := atom ('^' unary)? ;
    atom := number | 'x' | constant | function '(' expr ')' | '(' expr ')'
    Implicit multiplication (e.g. '2x') is not allowed: the model is asked to write '2*x'.
    """
    tokens = tokenize(expression)
    pos = 0

    def peek() -> str | None:
        return tokens[pos] if pos < len(tokens) else None

    def take(expected: str | None = None) -> str:
        nonlocal pos
        token = peek()
        if token is None or (expected is not None and token != expected):
            raise DiagramError(f"'{expression}' isn't a complete formula.")
        pos += 1
        return token

    def expr() -> tuple:
        node = term()
        while peek() in ("+", "-"):
            node = (take(), node, term())
        return node

    def term() -> tuple:
        node = unary()
        while peek() in ("*", "/"):
            node = (take(), node, unary())
        return node

    def unary() -> tuple:
        if peek() == "-":
            take()
            return ("neg", unary())
        if peek() == "+":
            take()
            return unary()
        return power()

    def power() -> tuple:
        base = atom()
        if peek() == "^":
            take()
            return ("^", base, unary())
        return base

    def atom() -> tuple:
        token = take()
        if token in FUNCTIONS:
            take("(")
            inner = expr()
            take(")")
            return ("fn", token, inner)
        if token == "(":
            inner = expr()
            take(")")
            return inner
        if token == "x":
            return ("x",)
        if token in CONSTANTS:
            return ("num", math.pi if token == "pi" else math.e)
        if re.fullmatch(r"\d+(\.\d+)?|\.\d+", token):
            return ("num", float(token))
        raise DiagramError(f"'{expression}' isn't a valid formula.")

    tree = expr()
    if pos != len(tokens):
        raise DiagramError(f"'{expression}' has something extra at the end.")
    return tree


def check_expression(expression: str) -> None:
    """Raise DiagramError unless `expression` is a valid formula in x."""
    parse_expression(expression)


_FN = {
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "sqrt": math.sqrt,
    "abs": abs,
    "log": math.log10,
    "ln": math.log,
    "exp": math.exp,
}


def _evaluate(node: tuple, x: float) -> float:
    kind = node[0]
    if kind == "num":
        return node[1]
    if kind == "x":
        return x
    if kind == "neg":
        return -_evaluate(node[1], x)
    if kind == "fn":
        return _FN[node[1]](_evaluate(node[2], x))
    a, b = _evaluate(node[1], x), _evaluate(node[2], x)
    if kind == "+":
        return a + b
    if kind == "-":
        return a - b
    if kind == "*":
        return a * b
    if kind == "/":
        return a / b
    return a**b


def compile_expression(expression: str):
    """A function of x for a valid formula; NaN where it is undefined (e.g. sqrt(-1), 1/0)."""
    tree = parse_expression(expression)

    def f(x: float) -> float:
        try:
            value = _evaluate(tree, x)
        except (ValueError, ZeroDivisionError, OverflowError):
            return math.nan
        return value if isinstance(value, float | int) and math.isfinite(value) else math.nan

    return f


# --- validation ---------------------------------------------------------------------


def _clean(text: str, limit: int) -> str:
    return " ".join(text.split())[:limit]


def normalize_diagram(spec: DiagramSpec, topic: str) -> DiagramSpec:
    """Repair model output into a usable diagram, or raise LLMError if it can't be."""
    is_graph = spec.diagram_type == "graph_fn"

    elements, ids = [], set()
    if not is_graph:
        for e in spec.elements[:MAX_ELEMENTS]:
            label = _clean(e.label, LABEL_CHARS)
            if not label or not e.id or e.id in ids:
                continue
            ids.add(e.id)
            kind = e.kind if spec.diagram_type != "timeline" else "event"
            elements.append(
                Element(
                    id=e.id,
                    kind=kind,
                    label=label,
                    tag=_clean(e.tag, TAG_CHARS),
                    detail=_clean(e.detail, TEXT_CHARS),
                )
            )
        if len(elements) < 2:
            raise LLMError("The diagram came back too small. Please try again.")

    connectors, pairs = [], set()
    if spec.diagram_type in ("flowchart", "block", "process"):
        for c in spec.connectors:
            pair = (c.source, c.target)
            if c.source not in ids or c.target not in ids or c.source == c.target or pair in pairs:
                continue
            pairs.add(pair)
            connectors.append(
                # A fresh prefix, so a step naming a dropped connector can't hit a kept one.
                Connector(
                    id=f"link{len(connectors)}",
                    source=c.source,
                    target=c.target,
                    label=_clean(c.label, 30),
                )
            )
            if len(connectors) == MAX_CONNECTORS:
                break
    # Remember the model's connector ids so steps that name them still work.
    renamed = {
        c.id: kept.id
        for c in spec.connectors
        for kept in connectors
        if (c.source, c.target) == (kept.source, kept.target)
    }

    functions, points = [], []
    x_min, x_max = spec.x_min, spec.x_max
    if is_graph:
        for f in spec.functions:
            try:
                check_expression(f.expression)
            except DiagramError:
                continue
            if f.id and f.id not in ids:
                ids.add(f.id)
                functions.append(
                    PlotFunction(
                        id=f.id, expression=f.expression.strip(), label=_clean(f.label, LABEL_CHARS)
                    )
                )
            if len(functions) == MAX_FUNCTIONS:
                break
        if not functions:
            raise LLMError("The graph's formula couldn't be used. Please try again.")
        if (
            not (math.isfinite(x_min) and math.isfinite(x_max))
            or x_min >= x_max
            or x_max - x_min > 1e4
        ):
            x_min, x_max = -10.0, 10.0
        for p in spec.points[:MAX_POINTS]:
            if p.id and p.id not in ids and math.isfinite(p.x) and math.isfinite(p.y):
                ids.add(p.id)
                points.append(PlotPoint(id=p.id, x=p.x, y=p.y, label=_clean(p.label, LABEL_CHARS)))

    known = ids | {c.id for c in connectors}
    steps, shown = [], set()
    for s in spec.steps[:MAX_STEPS]:
        show = [renamed.get(i, i) for i in s.show]
        show = [i for i in dict.fromkeys(show) if i in known and i not in shown]
        if not show:
            continue
        shown.update(show)
        steps.append(
            Step(
                title=_clean(s.title, LABEL_CHARS) or f"Step {len(steps) + 1}",
                explanation=_clean(s.explanation, TEXT_CHARS),
                show=show,
            )
        )
    order = (
        [e.id for e in elements]
        + [c.id for c in connectors]
        + [f.id for f in functions]
        + [p.id for p in points]
    )
    missing = [i for i in order if i not in shown]
    if missing:
        if steps:
            steps[-1] = steps[-1].model_copy(update={"show": [*steps[-1].show, *missing]})
        else:
            steps = [
                Step(title=_clean(spec.title, LABEL_CHARS) or topic, explanation="", show=missing)
            ]

    return DiagramSpec(
        title=_clean(spec.title, 120) or topic,
        diagram_type=spec.diagram_type,
        elements=elements,
        connectors=connectors,
        functions=functions,
        points=points,
        x_min=x_min,
        x_max=x_max,
        x_label=_clean(spec.x_label, 30) if is_graph else "",
        y_label=_clean(spec.y_label, 30) if is_graph else "",
        steps=steps,
    )
