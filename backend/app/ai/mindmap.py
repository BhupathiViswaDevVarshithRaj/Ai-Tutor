"""Mind maps: structured output schema, repair of model output, and strict graph validation.

A map is a tree of nodes (one root, every other node has a parent) plus a few optional
cross-links between branches. Model output is repaired (`normalize_generated`): ids are
reassigned, orphans attach to the root, cycles and over-deep branches are dropped. Learner
edits are checked strictly (`validate_graph`) and rejected with a reason instead.
"""

from typing import Literal

from pydantic import BaseModel

from app.ai.llm.base import LLMError

NodeKind = Literal["topic", "idea", "concept", "example", "definition"]

MAX_DEPTH = 5  # root is depth 0
MAX_GENERATED_NODES = 60
MAX_NODES = 150
MAX_LINKS = 12
LABEL_CHARS = 80
DETAIL_CHARS = 400
RELATION_CHARS = 40


class MapNode(BaseModel):
    id: str
    parent: str  # "" for the central topic
    label: str
    kind: NodeKind
    detail: str  # one-sentence definition or explanation; may be empty


class MapLink(BaseModel):
    source: str
    target: str
    relation: str


class MindMapGraph(BaseModel):
    title: str
    nodes: list[MapNode]
    links: list[MapLink]


class BranchNode(BaseModel):
    label: str
    kind: NodeKind
    detail: str


class Branch(BaseModel):
    """New children for one node (AI expansion)."""

    nodes: list[BranchNode]


class GraphError(ValueError):
    """A learner edit produced an invalid map; the message says why."""


def _clean(text: str, limit: int) -> str:
    return " ".join(text.split())[:limit]


def _depths(nodes: list[MapNode]) -> dict[str, int]:
    """Depth of every node reachable from the root (unreachable / cyclic nodes are absent)."""
    children: dict[str, list[str]] = {}
    root = None
    for n in nodes:
        if n.parent:
            children.setdefault(n.parent, []).append(n.id)
        elif root is None:
            root = n.id
    depths: dict[str, int] = {}
    stack = [(root, 0)] if root else []
    while stack:
        node_id, depth = stack.pop()
        if node_id in depths:
            continue
        depths[node_id] = depth
        stack.extend((child, depth + 1) for child in children.get(node_id, []))
    return depths


def validate_graph(graph: MindMapGraph) -> MindMapGraph:
    """Strict check for learner edits. Returns a cleaned copy or raises GraphError."""
    title = _clean(graph.title, 200)
    if not title:
        raise GraphError("The map needs a title.")
    if not graph.nodes:
        raise GraphError("The map needs a central topic.")
    if len(graph.nodes) > MAX_NODES:
        raise GraphError(f"A map can have at most {MAX_NODES} nodes.")
    ids = [n.id for n in graph.nodes]
    if len(set(ids)) != len(ids) or any(not i.strip() for i in ids):
        raise GraphError("Every node needs its own id.")
    roots = [n for n in graph.nodes if not n.parent]
    if len(roots) != 1:
        raise GraphError("A map has exactly one central topic.")
    known = set(ids)
    if any(n.parent and n.parent not in known for n in graph.nodes):
        raise GraphError("A node is attached to a node that doesn't exist.")
    depths = _depths(graph.nodes)
    if len(depths) != len(graph.nodes):
        raise GraphError("Nodes can't be their own ancestors.")
    if max(depths.values()) > MAX_DEPTH:
        raise GraphError(f"Branches can be at most {MAX_DEPTH} levels deep.")

    nodes = []
    for n in graph.nodes:
        label = _clean(n.label, LABEL_CHARS)
        if not label:
            raise GraphError("Every node needs a label.")
        kind = "topic" if not n.parent else ("idea" if n.kind == "topic" else n.kind)
        nodes.append(
            MapNode(
                id=n.id,
                parent=n.parent,
                label=label,
                kind=kind,
                detail=_clean(n.detail, DETAIL_CHARS),
            )
        )
    return MindMapGraph(
        title=title, nodes=nodes, links=_valid_links(graph.links, nodes, strict=True)
    )


def _valid_links(links: list[MapLink], nodes: list[MapNode], *, strict: bool) -> list[MapLink]:
    known = {n.id for n in nodes}
    tree_edges = {(n.parent, n.id) for n in nodes if n.parent}
    out, seen = [], set()
    for link in links:
        pair = (link.source, link.target)
        problem = (
            link.source not in known
            or link.target not in known
            or link.source == link.target
            or pair in tree_edges
            or pair[::-1] in tree_edges
            or pair in seen
        )
        if problem:
            if strict:
                raise GraphError("A cross-link must join two different, unconnected nodes.")
            continue
        seen.add(pair)
        out.append(
            MapLink(
                source=link.source,
                target=link.target,
                relation=_clean(link.relation, RELATION_CHARS),
            )
        )
    if len(out) > MAX_LINKS:
        if strict:
            raise GraphError(f"A map can have at most {MAX_LINKS} cross-links.")
        out = out[:MAX_LINKS]
    return out


def normalize_generated(graph: MindMapGraph, topic: str) -> MindMapGraph:
    """Repair model output into a valid map: ids n0..nN, one root, no orphans or cycles."""
    raw = [n for n in graph.nodes if _clean(n.label, LABEL_CHARS)]
    if not raw:
        raise LLMError("The mind map couldn't be prepared. Please try again.")
    by_id: dict[str, MapNode] = {}
    for n in raw:
        by_id.setdefault(n.id, n)  # duplicate ids: keep the first

    def detached(n: MapNode) -> bool:
        return not n.parent or n.parent not in by_id or n.parent == n.id

    roots = [n for n in by_id.values() if detached(n)]
    # Prefer a node the model marked as the root; otherwise any detached node, or the first.
    root = next((n for n in roots if not n.parent), None) or (roots[0] if roots else None)
    root = root or next(iter(by_id.values()))

    # Attach orphans (and extra roots) to the root, then keep only what the root reaches;
    # nodes caught in a cycle of their own are unreachable and dropped.
    fixed = []
    for n in by_id.values():
        if n.id == root.id:
            fixed.append(n.model_copy(update={"parent": ""}))
        elif detached(n):
            fixed.append(n.model_copy(update={"parent": root.id}))
        else:
            fixed.append(n)
    depths = _depths(fixed)
    kept = [n for n in fixed if depths.get(n.id, MAX_DEPTH + 1) <= MAX_DEPTH]
    kept.sort(key=lambda n: depths[n.id])
    kept = kept[:MAX_GENERATED_NODES]

    new_id = {n.id: f"n{i}" for i, n in enumerate(kept)}
    nodes = [
        MapNode(
            id=new_id[n.id],
            parent=new_id.get(n.parent, "") if n.id != root.id else "",
            label=_clean(n.label, LABEL_CHARS),
            kind="topic" if n.id == root.id else ("idea" if n.kind == "topic" else n.kind),
            detail=_clean(n.detail, DETAIL_CHARS),
        )
        for n in kept
    ]
    links = [
        MapLink(source=new_id[link.source], target=new_id[link.target], relation=link.relation)
        for link in graph.links
        if link.source in new_id and link.target in new_id
    ]
    if len(nodes) < 3:
        raise LLMError("The mind map came back too small. Please try again.")
    return MindMapGraph(
        title=_clean(graph.title, 200) or topic,
        nodes=nodes,
        links=_valid_links(links, nodes, strict=False),
    )


def attach_branch(graph: MindMapGraph, parent_id: str, branch: Branch) -> MindMapGraph:
    """Add generated children under `parent_id`, skipping labels the parent already has."""
    parent = next((n for n in graph.nodes if n.id == parent_id), None)
    if parent is None:
        raise GraphError("That node isn't in this map.")
    depth = _depths(graph.nodes).get(parent_id, 0)
    if depth >= MAX_DEPTH:
        raise GraphError(f"Branches can be at most {MAX_DEPTH} levels deep.")
    existing = {n.label.casefold() for n in graph.nodes if n.parent == parent_id}
    used = {n.id for n in graph.nodes}
    counter = len(graph.nodes)
    added = []
    for b in branch.nodes[:6]:
        label = _clean(b.label, LABEL_CHARS)
        if not label or label.casefold() in existing:
            continue
        while f"n{counter}" in used:
            counter += 1
        used.add(f"n{counter}")
        existing.add(label.casefold())
        added.append(
            MapNode(
                id=f"n{counter}",
                parent=parent_id,
                label=label,
                kind="idea" if b.kind == "topic" else b.kind,
                detail=_clean(b.detail, DETAIL_CHARS),
            )
        )
    if not added:
        raise LLMError("No new ideas came back for that branch. Try another node.", retryable=True)
    if len(graph.nodes) + len(added) > MAX_NODES:
        raise GraphError(f"A map can have at most {MAX_NODES} nodes.")
    return graph.model_copy(update={"nodes": [*graph.nodes, *added]})
