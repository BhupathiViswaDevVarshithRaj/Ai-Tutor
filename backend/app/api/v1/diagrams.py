import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.ai.llm.base import LLMProvider
from app.ai.llm.factory import get_llm
from app.api.deps import CurrentUser, SessionDep
from app.core.rate_limit import RateLimiter
from app.schemas.common import Page
from app.schemas.diagrams import (
    DiagramCreate,
    DiagramOut,
    DiagramSummary,
    DiagramUpdate,
    SketchCreate,
)
from app.services import diagram_service

router = APIRouter(prefix="/diagrams", tags=["diagrams"])

LLM = Annotated[LLMProvider, Depends(get_llm)]
AI_LIMIT = [Depends(RateLimiter("ai", "ai_rate_limit", "ai_rate_window_seconds"))]


@router.get("")
async def list_diagrams(
    user: CurrentUser,
    session: SessionDep,
    lesson_id: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[DiagramSummary]:
    items, total = await diagram_service.list_diagrams(
        session, user.id, lesson_id=lesson_id, limit=limit, offset=offset
    )
    return Page[DiagramSummary](
        items=[diagram_service.to_summary(i) for i in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=AI_LIMIT)
async def create_diagram(
    data: DiagramCreate, user: CurrentUser, session: SessionDep, llm: LLM
) -> DiagramOut:
    """Draw a step-by-step diagram for a topic (or a lesson)."""
    return diagram_service.to_out(await diagram_service.generate(session, llm, user, data))


@router.post("/sketch", status_code=status.HTTP_201_CREATED)
async def create_sketch(data: SketchCreate, user: CurrentUser, session: SessionDep) -> DiagramOut:
    """A blank board for freehand drawing."""
    return diagram_service.to_out(await diagram_service.create_sketch(session, user, data))


@router.get("/{diagram_id}")
async def get_diagram(diagram_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> DiagramOut:
    return diagram_service.to_out(await diagram_service.get_diagram(session, user.id, diagram_id))


@router.patch("/{diagram_id}")
async def update_diagram(
    diagram_id: uuid.UUID, data: DiagramUpdate, user: CurrentUser, session: SessionDep
) -> DiagramOut:
    """Rename the board or save its freehand strokes."""
    return diagram_service.to_out(await diagram_service.update(session, user.id, diagram_id, data))


@router.delete("/{diagram_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_diagram(diagram_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> None:
    await diagram_service.delete(session, user.id, diagram_id)
