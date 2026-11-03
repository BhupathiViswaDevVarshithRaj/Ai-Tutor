"""mind maps

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-04 01:41:05.969095
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = '0005'
down_revision: str | None = '0004'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Created in 0002; reuse without re-creating the type.
LEARNING_LEVEL = postgresql.ENUM(
    'beginner', 'intermediate', 'advanced', name='learning_level', create_type=False
)


def upgrade() -> None:
    op.create_table('mind_maps',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('lesson_id', sa.UUID(), nullable=True),
    sa.Column('topic', sa.String(length=300), nullable=False),
    sa.Column('language', sa.String(length=10), nullable=False),
    sa.Column('level', LEARNING_LEVEL, nullable=False),
    sa.Column('graph', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('layout', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id'], name=op.f('fk_mind_maps_lesson_id_lessons'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_mind_maps_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_mind_maps'))
    )
    op.create_index(op.f('ix_mind_maps_lesson_id'), 'mind_maps', ['lesson_id'], unique=False)
    op.create_index('ix_mind_maps_user_created', 'mind_maps', ['user_id', sa.literal_column('created_at DESC')], unique=False)


def downgrade() -> None:
    op.drop_index('ix_mind_maps_user_created', table_name='mind_maps')
    op.drop_index(op.f('ix_mind_maps_lesson_id'), table_name='mind_maps')
    op.drop_table('mind_maps')
