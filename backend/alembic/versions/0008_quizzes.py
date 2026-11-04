"""quizzes

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-04 10:55:44.984350
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = '0008'
down_revision: str | None = '0007'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Created in 0002; reuse without re-creating the type.
LEARNING_LEVEL = postgresql.ENUM(
    'beginner', 'intermediate', 'advanced', name='learning_level', create_type=False
)


def upgrade() -> None:
    op.create_table('quizzes',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('lesson_id', sa.UUID(), nullable=True),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('topic', sa.String(length=300), nullable=False),
    sa.Column('focus', sa.String(length=300), nullable=True),
    sa.Column('language', sa.String(length=10), nullable=False),
    sa.Column('level', LEARNING_LEVEL, nullable=False),
    sa.Column('question_types', sa.String(length=20), nullable=False),
    sa.Column('question_count', sa.SmallInteger(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id'], name=op.f('fk_quizzes_lesson_id_lessons'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_quizzes_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_quizzes'))
    )
    op.create_index(op.f('ix_quizzes_lesson_id'), 'quizzes', ['lesson_id'], unique=False)
    op.create_index('ix_quizzes_user_created', 'quizzes', ['user_id', sa.literal_column('created_at DESC')], unique=False)
    op.create_table('quiz_questions',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('quiz_id', sa.UUID(), nullable=False),
    sa.Column('position', sa.SmallInteger(), nullable=False),
    sa.Column('qtype', sa.Enum('mcq', 'short_answer', name='question_type'), nullable=False),
    sa.Column('prompt', sa.Text(), nullable=False),
    sa.Column('options', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('correct_answer', sa.Text(), nullable=False),
    sa.Column('accepted_answers', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
    sa.Column('explanation', sa.Text(), nullable=False),
    sa.Column('concept', sa.String(length=120), nullable=False),
    sa.Column('difficulty', sa.SmallInteger(), nullable=False),
    sa.ForeignKeyConstraint(['quiz_id'], ['quizzes.id'], name=op.f('fk_quiz_questions_quiz_id_quizzes'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_quiz_questions')),
    sa.UniqueConstraint('quiz_id', 'position', name=op.f('uq_quiz_questions_quiz_id'))
    )
    op.create_table('quiz_submissions',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('quiz_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('score', sa.Float(), nullable=False),
    sa.Column('max_score', sa.Float(), nullable=False),
    sa.Column('duration_seconds', sa.Integer(), nullable=True),
    sa.Column('feedback', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('submitted_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['quiz_id'], ['quizzes.id'], name=op.f('fk_quiz_submissions_quiz_id_quizzes'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_quiz_submissions_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_quiz_submissions'))
    )
    op.create_index(op.f('ix_quiz_submissions_quiz_id'), 'quiz_submissions', ['quiz_id'], unique=False)
    op.create_index('ix_quiz_submissions_user_submitted', 'quiz_submissions', ['user_id', sa.literal_column('submitted_at DESC')], unique=False)
    op.create_table('quiz_answers',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('submission_id', sa.UUID(), nullable=False),
    sa.Column('question_id', sa.UUID(), nullable=False),
    sa.Column('answer', sa.Text(), nullable=False),
    sa.Column('is_correct', sa.Boolean(), nullable=False),
    sa.Column('score', sa.Float(), nullable=False),
    sa.Column('grader_feedback', sa.Text(), nullable=True),
    sa.Column('graded_by', sa.String(length=10), nullable=False),
    sa.ForeignKeyConstraint(['question_id'], ['quiz_questions.id'], name=op.f('fk_quiz_answers_question_id_quiz_questions'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['submission_id'], ['quiz_submissions.id'], name=op.f('fk_quiz_answers_submission_id_quiz_submissions'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_quiz_answers'))
    )
    op.create_index(op.f('ix_quiz_answers_submission_id'), 'quiz_answers', ['submission_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_quiz_answers_submission_id'), table_name='quiz_answers')
    op.drop_table('quiz_answers')
    op.drop_index('ix_quiz_submissions_user_submitted', table_name='quiz_submissions')
    op.drop_index(op.f('ix_quiz_submissions_quiz_id'), table_name='quiz_submissions')
    op.drop_table('quiz_submissions')
    op.drop_table('quiz_questions')
    op.drop_index('ix_quizzes_user_created', table_name='quizzes')
    op.drop_index(op.f('ix_quizzes_lesson_id'), table_name='quizzes')
    op.drop_table('quizzes')
    sa.Enum(name='question_type').drop(op.get_bind(), checkfirst=True)
