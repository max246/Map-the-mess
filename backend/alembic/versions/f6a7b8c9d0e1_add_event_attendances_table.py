"""add event attendances table

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-04-10

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "event_attendances",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["event_id"], ["community_events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", "user_id", name="uq_event_attendance"),
    )
    op.create_index(op.f("ix_event_attendances_id"), "event_attendances", ["id"])
    op.create_index(op.f("ix_event_attendances_event_id"), "event_attendances", ["event_id"])
    op.create_index(op.f("ix_event_attendances_user_id"), "event_attendances", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_event_attendances_user_id"), table_name="event_attendances")
    op.drop_index(op.f("ix_event_attendances_event_id"), table_name="event_attendances")
    op.drop_index(op.f("ix_event_attendances_id"), table_name="event_attendances")
    op.drop_table("event_attendances")
