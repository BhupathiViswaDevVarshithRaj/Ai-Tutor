"""diagrams

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-04 02:02:51.705567
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = '0006'
down_revision: str | None = '0005'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Created in 0002; reuse without re-creating the type.
LEARNING_LEVEL = postgresql.ENUM(
    'beginner', 'intermediate', 'advanced', name='learning_level', create_type=False
)


def upgrade() -> None:
    op.create_table('diagrams',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('lesson_id', sa.UUID(), nullable=True),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('topic', sa.String(length=300), nullable=True),
    sa.Column('language', sa.String(length=10), nullable=False),
    sa.Column('level', LEARNING_LEVEL, nullable=False),
    sa.Column('diagram_type', sa.Enum('flowchart', 'block', 'timeline', 'graph_fn', 'process', 'freehand', name='diagram_type'), nullable=False),
    sa.Column('spec', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('strokes', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id'], name=op.f('fk_diagrams_lesson_id_lessons'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_diagrams_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_diagrams'))
    )
    op.create_index(op.f('ix_diagrams_lesson_id'), 'diagrams', ['lesson_id'], unique=False)
    op.create_index('ix_diagrams_user_updated', 'diagrams', ['user_id', sa.literal_column('updated_at DESC')], unique=False)


def downgrade() -> None:
    op.drop_index('ix_diagrams_user_updated', table_name='diagrams')
    op.drop_index(op.f('ix_diagrams_lesson_id'), table_name='diagrams')
    op.drop_table('diagrams')
    sa.Enum(name='diagram_type').drop(op.get_bind(), checkfirst=True)
