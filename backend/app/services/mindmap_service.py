"""Mind maps: generation, AI expansion of a branch, learner edits and layout."""

import logging
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm.base import ChatMessage, LLMProvider
from app.ai.mindmap import (
    Branch,
    GraphError,
    MindMapGraph,
    attach_branch,
    normalize_generated,
    validate_graph,
)
from app.ai.prompts import MINDMAP_EXPAND_SYSTEM, MINDMAP_SYSTEM, expand_request, mindmap_request
from app.core.errors import AppError, NotFound
from app.db.models import MindMap, User
from app.schemas.mindmaps import (
    MindMapCreate,
    MindMapExpand,
    MindMapLayout,
    MindMapOut,
    MindMapSummary,
    MindMapUpdate,
)
from app.services.learning_service import get_lesson

logger = logging.getLogger(__name__)


def to_out(mind_map: MindMap) -> MindMapOut:
    return MindMapOut(
        id=mind_map.id,
        lesson_id=mind_map.lesson_id,
        topic=mind_map.topic,
        language=mind_map.language,
        level=mind_map.level,
        graph=MindMapGraph.model_validate(mind_map.graph),
        layout=MindMapLayout.model_validate(mind_map.layout) if mind_map.layout else None,
        version=mind_map.version,
        created_at=mind_map.created_at,
        updated_at=mind_map.updated_at,
    )


def to_summary(mind_map: MindMap) -> MindMapSummary:
    return MindMapSummary(
        id=mind_map.id,
        lesson_id=mind_map.lesson_id,
        title=mind_map.graph.get("title", mind_map.topic),
        topic=mind_map.topic,
        language=mind_map.language,
        level=mind_map.level,
        node_count=len(mind_map.graph.get("nodes", [])),
        updated_at=mind_map.updated_at,
    )


def _invalid(exc: GraphError) -> AppError:
    return AppError(422, "invalid_map", str(exc))


async def generate(
    session: AsyncSession, llm: LLMProvider, user: User, data: MindMapCreate
) -> MindMap:
    plan = None
    if data.lesson_id is not None:
        plan = (await get_lesson(session, user.id, data.lesson_id)).plan  # ownership check
    result = await llm.parse(
        system=MINDMAP_SYSTEM,
        messages=[
            ChatMessage(
                "user",
                mindmap_request(
                    topic=data.topic, level=data.level, language=data.language, plan=plan
                ),
            )
        ],
        schema=MindMapGraph,
    )
    graph = normalize_generated(result.value, data.topic)
    logger.info(
        "mind map generated model=%s nodes=%d out=%s",
        result.model,
        len(graph.nodes),
        result.usage.output_tokens,
    )
    mind_map = MindMap(
        user_id=user.id,
        lesson_id=data.lesson_id,
        topic=data.topic,
        language=data.language,
        level=data.level,
        graph=graph.model_dump(),
    )
    session.add(mind_map)
    await session.commit()
    await session.refresh(mind_map)
    return mind_map


async def list_maps(
    session: AsyncSession,
    user_id: uuid.UUID,
    *,
    lesson_id: uuid.UUID | None,
    limit: int,
    offset: int,
) -> tuple[list[MindMap], int]:
    filters = [MindMap.user_id == user_id]
    if lesson_id is not None:
        filters.append(MindMap.lesson_id == lesson_id)
    total = await session.scalar(select(func.count()).select_from(MindMap).where(*filters))
    rows = await session.scalars(
        select(MindMap)
        .where(*filters)
        .order_by(MindMap.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(rows), total or 0


async def get_map(session: AsyncSession, user_id: uuid.UUID, map_id: uuid.UUID) -> MindMap:
    mind_map = await session.get(MindMap, map_id)
    if mind_map is None or mind_map.user_id != user_id:
        raise NotFound("Mind map")
    return mind_map


def _check_version(mind_map: MindMap, version: int | None) -> None:
    if version is None:
        raise AppError(422, "version_required", "Send the map version you are editing.")
    if version != mind_map.version:
        raise AppError(
            409, "version_conflict", "This map changed somewhere else. Reload it and try again."
        )


def _clean_layout(layout: MindMapLayout, graph: dict) -> dict:
    """Keep layout entries only for nodes that exist."""
    known = {n["id"] for n in graph["nodes"]}
    return {
        "positions": {k: v.model_dump() for k, v in layout.positions.items() if k in known},
        "collapsed": [n for n in dict.fromkeys(layout.collapsed) if n in known],
    }


async def update(
    session: AsyncSession, user_id: uuid.UUID, map_id: uuid.UUID, data: MindMapUpdate
) -> MindMap:
    mind_map = await get_map(session, user_id, map_id)
    graph = dict(mind_map.graph)
    if data.graph is not None:
        _check_version(mind_map, data.version)
        try:
            graph = validate_graph(data.graph).model_dump()
        except GraphError as exc:
            raise _invalid(exc) from exc
        mind_map.version += 1
    if data.title is not None:
        graph["title"] = data.title
    if data.graph is not None or data.title is not None:
        mind_map.graph = graph
    if data.layout is not None:
        mind_map.layout = _clean_layout(data.layout, graph)
    elif data.graph is not None and mind_map.layout:
        # Drop layout entries for nodes the edit removed.
        mind_map.layout = _clean_layout(MindMapLayout.model_validate(mind_map.layout), graph)
    await session.commit()
    await session.refresh(mind_map)
    return mind_map


async def expand(
    session: AsyncSession,
    llm: LLMProvider,
    user_id: uuid.UUID,
    map_id: uuid.UUID,
    data: MindMapExpand,
) -> MindMap:
    """Ask the model for new children of one node and add them to the map."""
    mind_map = await get_map(session, user_id, map_id)
    _check_version(mind_map, data.version)
    if not any(n["id"] == data.node_id for n in mind_map.graph["nodes"]):
        raise NotFound("Node")
    result = await llm.parse(
        system=MINDMAP_EXPAND_SYSTEM,
        messages=[
            ChatMessage(
                "user",
                expand_request(
                    graph=mind_map.graph,
                    node_id=data.node_id,
                    level=mind_map.level,
                    language=mind_map.language,
                ),
            )
        ],
        schema=Branch,
    )
    try:
        graph = attach_branch(
            MindMapGraph.model_validate(mind_map.graph), data.node_id, result.value
        )
    except GraphError as exc:
        raise _invalid(exc) from exc
    mind_map.graph = graph.model_dump()
    mind_map.version += 1
    if mind_map.layout and data.node_id in mind_map.layout.get("collapsed", []):
        # Show the new ideas: expanding a collapsed node opens it.
        layout = dict(mind_map.layout)
        layout["collapsed"] = [n for n in layout["collapsed"] if n != data.node_id]
        mind_map.layout = layout
    await session.commit()
    await session.refresh(mind_map)
    return mind_map


async def delete(session: AsyncSession, user_id: uuid.UUID, map_id: uuid.UUID) -> None:
    await session.delete(await get_map(session, user_id, map_id))
    await session.commit()
