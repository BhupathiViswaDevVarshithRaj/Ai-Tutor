"""media and video jobs

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-04 02:34:16.632803
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = '0007'
down_revision: str | None = '0006'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Created in 0002; reuse without re-creating the type.
LEARNING_LEVEL = postgresql.ENUM(
    'beginner', 'intermediate', 'advanced', name='learning_level', create_type=False
)


def upgrade() -> None:
    op.create_table('media_assets',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('kind', sa.Enum('audio', 'video', 'subtitle', 'image', 'document', name='media_kind'), nullable=False),
    sa.Column('mime_type', sa.String(length=100), nullable=False),
    sa.Column('storage_key', sa.String(length=500), nullable=False),
    sa.Column('size_bytes', sa.BigInteger(), nullable=False),
    sa.Column('duration_ms', sa.Integer(), nullable=True),
    sa.Column('language', sa.String(length=10), nullable=True),
    sa.Column('meta', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_media_assets_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_media_assets')),
    sa.UniqueConstraint('storage_key', name=op.f('uq_media_assets_storage_key'))
    )
    op.create_table('video_jobs',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('lesson_id', sa.UUID(), nullable=True),
    sa.Column('topic', sa.String(length=300), nullable=False),
    sa.Column('language', sa.String(length=10), nullable=False),
    sa.Column('level', LEARNING_LEVEL, nullable=False),
    sa.Column('target_seconds', sa.SmallInteger(), nullable=False),
    sa.Column('status', sa.Enum('queued', 'scripting', 'narrating', 'rendering', 'compositing', 'completed', 'failed', 'cancelled', name='video_status'), server_default='queued', nullable=False),
    sa.Column('progress', sa.SmallInteger(), server_default='0', nullable=False),
    sa.Column('stage_detail', sa.String(length=200), nullable=True),
    sa.Column('script', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('error', sa.Text(), nullable=True),
    sa.Column('video_asset_id', sa.UUID(), nullable=True),
    sa.Column('subtitle_asset_id', sa.UUID(), nullable=True),
    sa.Column('narrated', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id'], name=op.f('fk_video_jobs_lesson_id_lessons'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['subtitle_asset_id'], ['media_assets.id'], name=op.f('fk_video_jobs_subtitle_asset_id_media_assets'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_video_jobs_user_id_users'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['video_asset_id'], ['media_assets.id'], name=op.f('fk_video_jobs_video_asset_id_media_assets'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_video_jobs'))
    )
    op.create_index(op.f('ix_video_jobs_lesson_id'), 'video_jobs', ['lesson_id'], unique=False)
    op.create_index('ix_video_jobs_status', 'video_jobs', ['status'], unique=False)
    op.create_index('ix_video_jobs_user_created', 'video_jobs', ['user_id', sa.literal_column('created_at DESC')], unique=False)
    op.create_foreign_key(op.f('fk_messages_audio_asset_id_media_assets'), 'messages', 'media_assets', ['audio_asset_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint(op.f('fk_messages_audio_asset_id_media_assets'), 'messages', type_='foreignkey')
    op.drop_index('ix_video_jobs_user_created', table_name='video_jobs')
    op.drop_index('ix_video_jobs_status', table_name='video_jobs')
    op.drop_index(op.f('ix_video_jobs_lesson_id'), table_name='video_jobs')
    op.drop_table('video_jobs')
    op.drop_table('media_assets')
    bind = op.get_bind()
    sa.Enum(name='video_status').drop(bind, checkfirst=True)
    sa.Enum(name='media_kind').drop(bind, checkfirst=True)
