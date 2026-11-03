"""language courses

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-03 14:46:15.003688
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = '0004'
down_revision: str | None = '0003'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Created once in upgrade() and shared by several tables (create_type=False avoids re-creating).
CEFR_LEVEL = postgresql.ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2', name='cefr_level', create_type=False)
PRACTICE_SKILL = postgresql.ENUM(
    'grammar', 'listening', 'reading', 'writing', 'speaking', 'conversation',
    name='practice_skill', create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    CEFR_LEVEL.create(bind, checkfirst=True)
    PRACTICE_SKILL.create(bind, checkfirst=True)
    op.create_table('language_enrollments',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('language', sa.String(length=10), nullable=False),
    sa.Column('level', CEFR_LEVEL, nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_language_enrollments_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_language_enrollments')),
    sa.UniqueConstraint('user_id', 'language', name=op.f('uq_language_enrollments_user_id'))
    )
    op.create_table('vocab_items',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('language', sa.String(length=10), nullable=False),
    sa.Column('word', sa.String(length=200), nullable=False),
    sa.Column('reading', sa.String(length=200), nullable=True),
    sa.Column('meaning', sa.String(length=300), nullable=False),
    sa.Column('example', sa.Text(), nullable=True),
    sa.Column('example_translation', sa.Text(), nullable=True),
    sa.Column('level', CEFR_LEVEL, nullable=False),
    sa.Column('topic', sa.String(length=100), nullable=True),
    sa.Column('ease', sa.Float(), server_default='2.5', nullable=False),
    sa.Column('interval_days', sa.Integer(), server_default='0', nullable=False),
    sa.Column('repetitions', sa.Integer(), server_default='0', nullable=False),
    sa.Column('lapses', sa.Integer(), server_default='0', nullable=False),
    sa.Column('due_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('last_reviewed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_vocab_items_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_vocab_items')),
    sa.UniqueConstraint('user_id', 'language', 'word', name=op.f('uq_vocab_items_user_id'))
    )
    op.create_index('ix_vocab_items_user_language_due', 'vocab_items', ['user_id', 'language', 'due_at'], unique=False)
    op.create_table('practice_sessions',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('language', sa.String(length=10), nullable=False),
    sa.Column('level', CEFR_LEVEL, nullable=False),
    sa.Column('skill', PRACTICE_SKILL, nullable=False),
    sa.Column('topic', sa.String(length=200), nullable=True),
    sa.Column('content', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('answers', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('result', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('score', sa.Float(), nullable=True),
    sa.Column('conversation_id', sa.UUID(), nullable=True),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], name=op.f('fk_practice_sessions_conversation_id_conversations'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_practice_sessions_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_practice_sessions'))
    )
    op.create_index(op.f('ix_practice_sessions_conversation_id'), 'practice_sessions', ['conversation_id'], unique=False)
    op.create_index('ix_practice_sessions_user_language_created', 'practice_sessions', ['user_id', 'language', sa.literal_column('created_at DESC')], unique=False)


def downgrade() -> None:
    op.drop_index('ix_practice_sessions_user_language_created', table_name='practice_sessions')
    op.drop_index(op.f('ix_practice_sessions_conversation_id'), table_name='practice_sessions')
    op.drop_table('practice_sessions')
    op.drop_index('ix_vocab_items_user_language_due', table_name='vocab_items')
    op.drop_table('vocab_items')
    op.drop_table('language_enrollments')
    bind = op.get_bind()
    PRACTICE_SKILL.drop(bind, checkfirst=True)
    CEFR_LEVEL.drop(bind, checkfirst=True)
