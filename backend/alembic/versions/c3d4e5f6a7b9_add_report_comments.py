"""add report_comments table

Revision ID: c3d4e5f6a7b9
Revises: b2c3d4e5f6a8
Create Date: 2026-04-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b9"
down_revision: Union[str, None] = "b2c3d4e5f6a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "report_comments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "report_id", sa.Uuid(), sa.ForeignKey("reports.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("body", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_report_comments_report_id", "report_comments", ["report_id"])


def downgrade() -> None:
    op.drop_index("ix_report_comments_report_id", table_name="report_comments")
    op.drop_table("report_comments")
