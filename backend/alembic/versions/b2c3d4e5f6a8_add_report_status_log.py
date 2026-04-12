"""add report status log table and cycle columns

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2026-04-12

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a8"
down_revision: Union[str, None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_action_enum = sa.Enum("created", "cleaned", "reopened", name="reportstatusaction")


def upgrade() -> None:
    op.create_table(
        "report_status_log",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("report_id", sa.Uuid(), nullable=False),
        sa.Column("action", _action_enum, nullable=False),
        sa.Column("cycle", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("performed_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["report_id"], ["reports.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["performed_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_report_status_log_id"), "report_status_log", ["id"])
    op.create_index(op.f("ix_report_status_log_report_id"), "report_status_log", ["report_id"])

    op.add_column(
        "reports",
        sa.Column("current_cycle", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "report_images",
        sa.Column("cycle", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("report_images", "cycle")
    op.drop_column("reports", "current_cycle")
    op.drop_index(op.f("ix_report_status_log_report_id"), table_name="report_status_log")
    op.drop_index(op.f("ix_report_status_log_id"), table_name="report_status_log")
    op.drop_table("report_status_log")
    _action_enum.drop(op.get_bind(), checkfirst=True)
