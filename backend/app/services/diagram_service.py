"""Whiteboard diagrams: generation, blank sketch boards, freehand strokes."""

import logging
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.diagram import DiagramSpec, normalize_diagram
from app.ai.llm.base import ChatMessage, LLMProvider
from app.ai.prompts import DIAGRAM_SYSTEM, diagram_request
from app.core.errors import AppError, NotFound
from app.db.enums import DiagramType
from app.db.models import Diagram, User
from app.schemas.diagrams import (
    MAX_TOTAL_POINTS,
    DiagramCreate,
    DiagramOut,
    DiagramSummary,
    DiagramUpdate,
    SketchCreate,
)
from app.services.learning_service import get_lesson

logger = logging.getLogger(__name__)


def to_out(diagram: Diagram) -> DiagramOut:
    return DiagramOut(
        id=diagram.id,
        lesson_id=diagram.lesson_id,
        title=diagram.title,
        topic=diagram.topic,
        language=diagram.language,
        level=diagram.level,
        diagram_type=diagram.diagram_type,
        spec=DiagramSpec.model_validate(diagram.spec) if diagram.spec else None,
        strokes=diagram.strokes,
        created_at=diagram.created_at,
        updated_at=diagram.updated_at,
    )


def to_summary(diagram: Diagram) -> DiagramSummary:
    return DiagramSummary(
        id=diagram.id,
        lesson_id=diagram.lesson_id,
        title=diagram.title,
        diagram_type=diagram.diagram_type,
        step_count=len((diagram.spec or {}).get("steps", [])),
        stroke_count=len(diagram.strokes),
        updated_at=diagram.updated_at,
    )


async def generate(
    session: AsyncSession, llm: LLMProvider, user: User, data: DiagramCreate
) -> Diagram:
    plan = None
    if data.lesson_id is not None:
        plan = (await get_lesson(session, user.id, data.lesson_id)).plan  # ownership check
    result = await llm.parse(
        system=DIAGRAM_SYSTEM,
        messages=[
            ChatMessage(
                "user",
                diagram_request(
                    topic=data.topic,
                    level=data.level,
                    language=data.language,
                    diagram_type=data.diagram_type,
                    plan=plan,
                ),
            )
        ],
        schema=DiagramSpec,
    )
    spec = normalize_diagram(result.value, data.topic)
    logger.info(
        "diagram generated type=%s model=%s steps=%d out=%s",
        spec.diagram_type,
        result.model,
        len(spec.steps),
        result.usage.output_tokens,
    )
    diagram = Diagram(
        user_id=user.id,
        lesson_id=data.lesson_id,
        title=spec.title,
        topic=data.topic,
        language=data.language,
        level=data.level,
        diagram_type=DiagramType(spec.diagram_type),
        spec=spec.model_dump(),
    )
    session.add(diagram)
    await session.commit()
    await session.refresh(diagram)
    return diagram


async def create_sketch(session: AsyncSession, user: User, data: SketchCreate) -> Diagram:
    diagram = Diagram(
        user_id=user.id,
        title=data.title,
        language=data.language,
        level=data.level,
        diagram_type=DiagramType.FREEHAND,
        spec=None,
    )
    session.add(diagram)
    await session.commit()
    await session.refresh(diagram)
    return diagram


async def list_diagrams(
    session: AsyncSession,
    user_id: uuid.UUID,
    *,
    lesson_id: uuid.UUID | None,
    limit: int,
    offset: int,
) -> tuple[list[Diagram], int]:
    filters = [Diagram.user_id == user_id]
    if lesson_id is not None:
        filters.append(Diagram.lesson_id == lesson_id)
    total = await session.scalar(select(func.count()).select_from(Diagram).where(*filters))
    rows = await session.scalars(
        select(Diagram)
        .where(*filters)
        .order_by(Diagram.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(rows), total or 0


async def get_diagram(session: AsyncSession, user_id: uuid.UUID, diagram_id: uuid.UUID) -> Diagram:
    diagram = await session.get(Diagram, diagram_id)
    if diagram is None or diagram.user_id != user_id:
        raise NotFound("Diagram")
    return diagram


async def update(
    session: AsyncSession, user_id: uuid.UUID, diagram_id: uuid.UUID, data: DiagramUpdate
) -> Diagram:
    diagram = await get_diagram(session, user_id, diagram_id)
    if data.title is not None:
        diagram.title = data.title
    if data.strokes is not None:
        if sum(len(s.points) for s in data.strokes) > MAX_TOTAL_POINTS:
            raise AppError(
                422, "too_much_drawing", "This board is full. Clear some drawing and try again."
            )
        diagram.strokes = [s.model_dump() for s in data.strokes]
    await session.commit()
    await session.refresh(diagram)
    return diagram


async def delete(session: AsyncSession, user_id: uuid.UUID, diagram_id: uuid.UUID) -> None:
    await session.delete(await get_diagram(session, user_id, diagram_id))
    await session.commit()
