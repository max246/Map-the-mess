"""add_plan_bins_table

Revision ID: d463788ee99d
Revises: c353677dd88c
Create Date: 2026-04-23 21:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "d463788ee99d"
down_revision: Union[str, None] = "c353677dd88c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "plan_bins",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("bin_id", sa.Uuid(), nullable=False),
        sa.Column("visit_order", sa.Integer(), nullable=False),
        sa.Column("leg_distance_meters", sa.Float(), nullable=True),
        sa.Column("leg_duration_seconds", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["bin_id"], ["bins.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plan_id", "bin_id", name="uq_plan_bin"),
    )
    op.create_index(op.f("ix_plan_bins_id"), "plan_bins", ["id"], unique=False)
    op.create_index(op.f("ix_plan_bins_plan_id"), "plan_bins", ["plan_id"], unique=False)
    op.create_index(op.f("ix_plan_bins_bin_id"), "plan_bins", ["bin_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_plan_bins_bin_id"), table_name="plan_bins")
    op.drop_index(op.f("ix_plan_bins_plan_id"), table_name="plan_bins")
    op.drop_index(op.f("ix_plan_bins_id"), table_name="plan_bins")
    op.drop_table("plan_bins")
