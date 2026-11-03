"""Unit tests for mind map repair (model output) and strict validation (learner edits)."""

import pytest

from app.ai.llm.base import LLMError
from app.ai.mindmap import (
    MAX_DEPTH,
    Branch,
    BranchNode,
    GraphError,
    MapLink,
    MapNode,
    MindMapGraph,
    attach_branch,
    normalize_generated,
    validate_graph,
)


def node(id, parent="", label=None, kind="idea", detail=""):
    return MapNode(id=id, parent=parent, label=label or f"Node {id}", kind=kind, detail=detail)


def graph(*nodes, links=(), title="Photosynthesis"):
    return MindMapGraph(title=title, nodes=list(nodes), links=list(links))


VALID = graph(
    node("a", kind="topic"),
    node("b", "a"),
    node("c", "a"),
    node("d", "b", kind="example"),
    links=[MapLink(source="d", target="c", relation="uses")],
)


# --- repairing model output ------------------------------------------------------


def test_generated_ids_are_renumbered_and_the_root_is_the_topic():
    fixed = normalize_generated(VALID, "Photosynthesis")
    assert [n.id for n in fixed.nodes] == ["n0", "n1", "n2", "n3"]
    assert fixed.nodes[0].parent == "" and fixed.nodes[0].kind == "topic"
    assert {n.parent for n in fixed.nodes[1:]} <= {"n0", "n1"}
    assert fixed.links == [MapLink(source="n3", target="n2", relation="uses")]


def test_orphans_attach_to_the_root_and_cycles_are_dropped():
    messy = graph(
        node("root", kind="topic"),
        node("x", "missing"),  # orphan
        node("y", "z"),  # y <-> z cycle, unreachable
        node("z", "y"),
        node("w", "root", label="   "),  # empty label
        node("v", "root", kind="topic"),  # a second "topic" becomes an idea
    )
    fixed = normalize_generated(messy, "T")
    labels = {n.label: n for n in fixed.nodes}
    assert set(labels) == {"Node root", "Node x", "Node v"}
    assert labels["Node x"].parent == "n0"
    assert labels["Node v"].kind == "idea"


def test_overly_deep_branches_are_trimmed():
    chain = [node("n0", kind="topic")] + [
        node(f"n{i}", f"n{i - 1}") for i in range(1, MAX_DEPTH + 3)
    ]
    fixed = normalize_generated(graph(*chain), "T")
    assert len(fixed.nodes) == MAX_DEPTH + 1


def test_links_to_dropped_or_parent_nodes_are_discarded():
    g = graph(
        node("a", kind="topic"),
        node("b", "a"),
        node("c", "a"),
        links=[
            MapLink(source="b", target="a", relation="parent"),  # duplicates a tree edge
            MapLink(source="b", target="nope", relation="x"),
            MapLink(source="b", target="c", relation="contrast"),
            MapLink(source="b", target="c", relation="dup"),
        ],
    )
    assert [(link.source, link.target) for link in normalize_generated(g, "T").links] == [
        ("n1", "n2")
    ]


def test_a_map_that_is_too_small_is_rejected():
    with pytest.raises(LLMError):
        normalize_generated(graph(node("a", kind="topic"), node("b", "a")), "T")


# --- strict validation of learner edits ---------------------------------------------


def test_a_valid_edit_is_cleaned_and_accepted():
    edited = graph(node("a", kind="concept", label="  Light   energy "), node("b", "a"))
    result = validate_graph(edited)
    assert result.nodes[0].label == "Light energy" and result.nodes[0].kind == "topic"


@pytest.mark.parametrize(
    ("bad", "message"),
    [
        (graph(), "central topic"),
        (graph(node("a", kind="topic"), node("b")), "exactly one central topic"),
        (graph(node("a", kind="topic"), node("a", "a")), "own id"),
        (graph(node("a", kind="topic"), node("b", "zz")), "doesn't exist"),
        (graph(node("a", kind="topic"), node("b", "c"), node("c", "b")), "own ancestors"),
        (graph(node("a", kind="topic"), node("b", "a", label=" ")), "label"),
        (graph(node("a", kind="topic"), title="  "), "title"),
        (
            graph(
                node("a", kind="topic"),
                node("b", "a"),
                links=[MapLink(source="a", target="b", relation="x")],
            ),
            "cross-link",
        ),
    ],
)
def test_invalid_edits_are_rejected_with_a_reason(bad, message):
    with pytest.raises(GraphError, match=message):
        validate_graph(bad)


def test_depth_limit_applies_to_edits():
    chain = [node("n0", kind="topic")] + [
        node(f"n{i}", f"n{i - 1}") for i in range(1, MAX_DEPTH + 2)
    ]
    with pytest.raises(GraphError, match="levels deep"):
        validate_graph(graph(*chain))


# --- AI expansion of a branch ------------------------------------------------------


def branch(*labels):
    return Branch(nodes=[BranchNode(label=label, kind="example", detail="d") for label in labels])


def test_new_children_get_fresh_ids_and_skip_existing_labels():
    expanded = attach_branch(VALID, "b", branch("Node d", "Leaves", "  ", "Roots"))
    added = expanded.nodes[len(VALID.nodes) :]
    assert [(n.label, n.parent) for n in added] == [("Leaves", "b"), ("Roots", "b")]
    assert len({n.id for n in expanded.nodes}) == len(expanded.nodes)


def test_expansion_needs_something_new_and_a_real_node():
    with pytest.raises(LLMError):
        attach_branch(VALID, "b", branch("Node d"))
    with pytest.raises(GraphError):
        attach_branch(VALID, "missing", branch("New"))
