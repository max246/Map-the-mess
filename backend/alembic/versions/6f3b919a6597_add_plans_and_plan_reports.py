"""add_plans_and_plan_reports

Revision ID: 6f3b919a6597
Revises: c3d4e5f6a7b9
Create Date: 2026-04-13 15:18:51.790422

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "6f3b919a6597"
down_revision: Union[str, None] = "c3d4e5f6a7b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "plans",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("start_latitude", sa.Float(), nullable=False),
        sa.Column("start_longitude", sa.Float(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("planned", "in_progress", "completed", name="planstatus"),
            nullable=False,
        ),
        sa.Column("total_distance_meters", sa.Float(), nullable=True),
        sa.Column("total_duration_seconds", sa.Float(), nullable=True),
        sa.Column("route_geometry", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_plans_id"), "plans", ["id"], unique=False)
    op.create_index(op.f("ix_plans_user_id"), "plans", ["user_id"], unique=False)
    op.create_table(
        "plan_reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("report_id", sa.Uuid(), nullable=False),
        sa.Column("visit_order", sa.Integer(), nullable=False),
        sa.Column("leg_distance_meters", sa.Float(), nullable=True),
        sa.Column("leg_duration_seconds", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["report_id"], ["reports.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plan_id", "report_id", name="uq_plan_report"),
    )
    op.create_index(op.f("ix_plan_reports_id"), "plan_reports", ["id"], unique=False)
    op.create_index(op.f("ix_plan_reports_plan_id"), "plan_reports", ["plan_id"], unique=False)
    op.create_index(op.f("ix_plan_reports_report_id"), "plan_reports", ["report_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_plan_reports_report_id"), table_name="plan_reports")
    op.drop_index(op.f("ix_plan_reports_plan_id"), table_name="plan_reports")
    op.drop_index(op.f("ix_plan_reports_id"), table_name="plan_reports")
    op.drop_table("plan_reports")
    op.drop_index(op.f("ix_plans_user_id"), table_name="plans")
    op.drop_index(op.f("ix_plans_id"), table_name="plans")
    op.drop_table("plans")
