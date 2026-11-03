"""Unit tests for diagram formulas (whitelisted grammar) and repair of model output."""

import pytest

from app.ai.diagram import (
    Connector,
    DiagramError,
    DiagramSpec,
    Element,
    PlotFunction,
    PlotPoint,
    Step,
    check_expression,
    normalize_diagram,
)
from app.ai.llm.base import LLMError


@pytest.mark.parametrize(
    "expression",
    [
        "x^2 - 2*x + 1",
        "sin(x)",
        "-x",
        "2*pi*x",
        "sqrt(abs(x))",
        "e^(-x^2)",
        "ln(x) / log(10)",
        "x**3",
        ".5*x",
        "((x))",
    ],
)
def test_valid_formulas_are_accepted(expression):
    check_expression(expression)


@pytest.mark.parametrize(
    "expression",
    [
        "",
        "2x",  # implicit multiplication is not allowed
        "x +",
        "sin x",
        "(x",
        "x)",
        "y + 1",  # only x
        "__import__('os')",
        "exp(x); 1",
        "x == 1",
        "lambda: x",
        "open(x)",
        "x[0]",
        "1e5",  # 'e5' is not a name
    ],
)
def test_anything_else_is_rejected(expression):
    with pytest.raises(DiagramError):
        check_expression(expression)


def el(id_, label=None, kind="box", tag=""):
    return Element(id=id_, kind=kind, label=label or f"Item {id_}", tag=tag, detail="d")


def spec(
    diagram_type="flowchart", elements=(), connectors=(), functions=(), points=(), steps=(), **extra
):
    base = dict(
        title="Topic",
        diagram_type=diagram_type,
        elements=list(elements),
        connectors=list(connectors),
        functions=list(functions),
        points=list(points),
        x_min=0,
        x_max=1,
        x_label="",
        y_label="",
        steps=list(steps),
    )
    return DiagramSpec(**{**base, **extra})


def test_flowchart_repair_drops_bad_items_and_reveals_everything():
    raw = spec(
        elements=[el("a"), el("b"), el("a", "duplicate"), el("c", "  ")],
        connectors=[
            Connector(id="x1", source="a", target="b", label="next"),
            Connector(id="x2", source="a", target="zz", label=""),  # unknown target
            Connector(id="x3", source="b", target="b", label=""),  # self loop
            Connector(id="x4", source="a", target="b", label="dup"),
        ],
        steps=[
            Step(title="First", explanation="Start here.", show=["a", "x1", "nope"]),
            Step(title="Empty", explanation="", show=["x2"]),  # nothing valid: dropped
        ],
    )
    fixed = normalize_diagram(raw, "Topic")
    assert [e.id for e in fixed.elements] == ["a", "b"]
    assert [(c.id, c.label) for c in fixed.connectors] == [("link0", "next")]
    # The model's connector id maps to the new one; unshown 'b' joins the last step.
    assert [s.show for s in fixed.steps] == [["a", "link0", "b"]]


def test_timeline_elements_become_events():
    fixed = normalize_diagram(
        spec("timeline", elements=[el("a", tag="1900"), el("b", kind="box")]), "T"
    )
    assert {e.kind for e in fixed.elements} == {"event"}
    assert fixed.connectors == [] and fixed.steps[0].show == ["a", "b"]


def test_graph_keeps_valid_formulas_and_fixes_the_range():
    raw = spec(
        "graph_fn",
        elements=[el("ignored"), el("also")],
        functions=[
            PlotFunction(id="f1", expression="x^2", label="square"),
            PlotFunction(id="f2", expression="import os", label="bad"),
        ],
        points=[
            PlotPoint(id="p", x=0, y=0, label="origin"),
            PlotPoint(id="q", x=float("nan"), y=0, label="bad"),
        ],
        x_min=5,
        x_max=-5,
        x_label="time",
        y_label="height",
    )
    fixed = normalize_diagram(raw, "T")
    assert [f.id for f in fixed.functions] == ["f1"]
    assert [p.id for p in fixed.points] == ["p"]
    assert fixed.elements == [] and (fixed.x_min, fixed.x_max) == (-10, 10)
    assert fixed.steps[0].show == ["f1", "p"]


def test_unusable_output_is_rejected():
    with pytest.raises(LLMError):
        normalize_diagram(spec(elements=[el("only")]), "T")
    with pytest.raises(LLMError):
        normalize_diagram(
            spec("graph_fn", functions=[PlotFunction(id="f", expression="x y", label="")]), "T"
        )
