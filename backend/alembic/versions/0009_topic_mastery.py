"""topic mastery

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-04 10:55:44.984350
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '0009'
down_revision: str | None = '0008'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('topic_mastery',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('topic_key', sa.String(length=300), nullable=False),
    sa.Column('topic', sa.String(length=300), nullable=False),
    sa.Column('concept_key', sa.String(length=120), nullable=False),
    sa.Column('concept', sa.String(length=120), nullable=False),
    sa.Column('mastery', sa.Float(), nullable=False),
    sa.Column('evidence_count', sa.Integer(), nullable=False),
    sa.Column('last_assessed_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('next_review_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_topic_mastery_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_topic_mastery')),
    sa.UniqueConstraint('user_id', 'topic_key', 'concept_key', name=op.f('uq_topic_mastery_user_id'))
    )
    op.create_index('ix_topic_mastery_user_mastery', 'topic_mastery', ['user_id', 'mastery'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_topic_mastery_user_mastery', table_name='topic_mastery')
    op.drop_table('topic_mastery')
