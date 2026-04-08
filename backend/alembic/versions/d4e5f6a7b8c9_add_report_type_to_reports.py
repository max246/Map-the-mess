"""add report_type to reports

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-04-08

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Enum values matching app.models.report.ReportType
report_type_enum = sa.Enum("litter", "gas_canister", name="reporttype")


def upgrade() -> None:
    report_type_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "reports",
        sa.Column("report_type", report_type_enum, nullable=True),
    )
    # Backfill existing reports as 'litter'
    op.execute("UPDATE reports SET report_type = 'litter' WHERE report_type IS NULL")
    with op.batch_alter_table("reports") as batch_op:
        batch_op.alter_column("report_type", nullable=False)


def downgrade() -> None:
    op.drop_column("reports", "report_type")
    report_type_enum.drop(op.get_bind(), checkfirst=True)
