"""remove fixmystreet from reporttype enum

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
Create Date: 2026-05-03

FixMyStreet submissions are now forwarded directly to FMS without ever
being written to our database, so the enum value is dead. Any existing
rows with report_type='fixmystreet' are deleted (their dependent
status-log/image/comment rows cascade via the FK definitions).

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f8a9b0c1d2e3"
down_revision: Union[str, None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # Delete any rows that used the value being removed. Cascade deletes via
    # FK relationships handle dependent rows (images, status_log, comments,
    # plan_reports, event_reports, favourites).
    op.execute("DELETE FROM reports WHERE report_type = 'fixmystreet'")

    # SQLite stores enums as plain text — nothing to alter at the type level.
    if bind.dialect.name != "postgresql":
        return

    # Postgres has no DROP VALUE for enum types. Recreate the type without the
    # 'fixmystreet' value and swap it onto the column.
    op.execute("ALTER TYPE reporttype RENAME TO reporttype_old")
    new_enum = sa.Enum("litter", "gas_canister", name="reporttype")
    new_enum.create(bind, checkfirst=False)
    op.execute(
        "ALTER TABLE reports "
        "ALTER COLUMN report_type TYPE reporttype USING report_type::text::reporttype"
    )
    op.execute("DROP TYPE reporttype_old")


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE reporttype ADD VALUE IF NOT EXISTS 'fixmystreet'")
