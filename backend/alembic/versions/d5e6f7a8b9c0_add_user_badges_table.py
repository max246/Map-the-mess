"""add user_badges table

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-04-18

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_badges",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("badge_id", sa.String(), nullable=False),
        sa.Column("awarded_at", sa.DateTime(), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "badge_id", name="uq_user_badge"),
    )
    op.create_index(op.f("ix_user_badges_id"), "user_badges", ["id"])
    op.create_index(op.f("ix_user_badges_user_id"), "user_badges", ["user_id"])
    op.create_index(op.f("ix_user_badges_badge_id"), "user_badges", ["badge_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_user_badges_badge_id"), table_name="user_badges")
    op.drop_index(op.f("ix_user_badges_user_id"), table_name="user_badges")
    op.drop_index(op.f("ix_user_badges_id"), table_name="user_badges")
    op.drop_table("user_badges")
