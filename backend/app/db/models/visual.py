"""Visual learning: mind maps (Phase 10) and whiteboard diagrams (Phase 11)."""

import uuid
from typing import Any

from sqlalchemy import ForeignKey, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, pg_enum, uuid_pk
from app.db.enums import DiagramType, LearningLevel


class MindMap(TimestampMixin, Base):
    """A validated mind map (`graph`) plus the learner's own layout of it."""

    __tablename__ = "mind_maps"
    __table_args__ = (Index("ix_mind_maps_user_created", "user_id", text("created_at DESC")),)

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    lesson_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="SET NULL"), index=True
    )
    topic: Mapped[str] = mapped_column(String(300))
    language: Mapped[str] = mapped_column(String(10))
    level: Mapped[LearningLevel] = mapped_column(pg_enum(LearningLevel, "learning_level"))
    # {title, nodes: [{id, parent, label, kind, detail}], links: [{source, target, relation}]}
    graph: Mapped[dict[str, Any]] = mapped_column(JSONB)
    # {positions: {node_id: {x, y}}, collapsed: [node_id]}: how the learner arranged it.
    layout: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    # Bumped on every change to `graph`; edits must name the version they started from.
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")


class Diagram(TimestampMixin, Base):
    """A whiteboard: an optional generated diagram (`spec`) plus the learner's freehand strokes."""

    __tablename__ = "diagrams"
    __table_args__ = (Index("ix_diagrams_user_updated", "user_id", text("updated_at DESC")),)

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    lesson_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    topic: Mapped[str | None] = mapped_column(String(300))
    language: Mapped[str] = mapped_column(String(10))
    level: Mapped[LearningLevel] = mapped_column(pg_enum(LearningLevel, "learning_level"))
    diagram_type: Mapped[DiagramType] = mapped_column(pg_enum(DiagramType, "diagram_type"))
    # Validated DiagramSpec; null for a blank sketch board.
    spec: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    # Freehand layer: [{tool, color, width, points: [[x, y], ...]}].
    strokes: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, server_default=text("'[]'::jsonb")
    )
