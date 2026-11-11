"""video style

Revision ID: 0010
Revises: 0009
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "video_jobs",
        sa.Column("style", sa.String(length=20), server_default="auto", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("video_jobs", "style")
