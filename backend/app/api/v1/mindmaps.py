import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.ai.llm.base import LLMProvider
from app.ai.llm.factory import get_llm
from app.api.deps import CurrentUser, SessionDep
from app.core.rate_limit import RateLimiter
from app.schemas.common import Page
from app.schemas.mindmaps import (
    MindMapCreate,
    MindMapExpand,
    MindMapOut,
    MindMapSummary,
    MindMapUpdate,
)
from app.services import mindmap_service

router = APIRouter(prefix="/mindmaps", tags=["mind maps"])

LLM = Annotated[LLMProvider, Depends(get_llm)]
AI_LIMIT = [Depends(RateLimiter("ai", "ai_rate_limit", "ai_rate_window_seconds"))]


@router.get("")
async def list_maps(
    user: CurrentUser,
    session: SessionDep,
    lesson_id: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[MindMapSummary]:
    items, total = await mindmap_service.list_maps(
        session, user.id, lesson_id=lesson_id, limit=limit, offset=offset
    )
    return Page[MindMapSummary](
        items=[mindmap_service.to_summary(i) for i in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=AI_LIMIT)
async def create_map(
    data: MindMapCreate, user: CurrentUser, session: SessionDep, llm: LLM
) -> MindMapOut:
    """Generate a validated mind map for a topic (or from a lesson's plan)."""
    return mindmap_service.to_out(await mindmap_service.generate(session, llm, user, data))


@router.get("/{map_id}")
async def get_map(map_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> MindMapOut:
    return mindmap_service.to_out(await mindmap_service.get_map(session, user.id, map_id))


@router.patch("/{map_id}")
async def update_map(
    map_id: uuid.UUID, data: MindMapUpdate, user: CurrentUser, session: SessionDep
) -> MindMapOut:
    """Rename, edit the graph (validated; needs the current version) or save the layout."""
    return mindmap_service.to_out(await mindmap_service.update(session, user.id, map_id, data))


@router.post("/{map_id}/expand", dependencies=AI_LIMIT)
async def expand_node(
    map_id: uuid.UUID, data: MindMapExpand, user: CurrentUser, session: SessionDep, llm: LLM
) -> MindMapOut:
    """Add AI-generated children under one node."""
    return mindmap_service.to_out(await mindmap_service.expand(session, llm, user.id, map_id, data))


@router.delete("/{map_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_map(map_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> None:
    await mindmap_service.delete(session, user.id, map_id)
