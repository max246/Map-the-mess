"""add recurrence to community events

Revision ID: a1b2c3d4e5f7
Revises: f6a7b8c9d0e1
Create Date: 2026-04-12

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("community_events", sa.Column("recurrence_rule", sa.String(), nullable=True))
    op.add_column("community_events", sa.Column("recurrence_end", sa.DateTime(), nullable=True))
    op.add_column(
        "community_events",
        sa.Column("parent_event_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "community_events",
        sa.Column("is_cancelled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_foreign_key(
        "fk_event_parent",
        "community_events",
        "community_events",
        ["parent_event_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        op.f("ix_community_events_parent_event_id"),
        "community_events",
        ["parent_event_id"],
    )
    op.create_unique_constraint(
        "uq_event_occurrence",
        "community_events",
        ["parent_event_id", "date"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_event_occurrence", "community_events", type_="unique")
    op.drop_index(op.f("ix_community_events_parent_event_id"), table_name="community_events")
    op.drop_constraint("fk_event_parent", "community_events", type_="foreignkey")
    op.drop_column("community_events", "is_cancelled")
    op.drop_column("community_events", "parent_event_id")
    op.drop_column("community_events", "recurrence_end")
    op.drop_column("community_events", "recurrence_rule")
