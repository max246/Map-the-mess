"""add fixmystreet to reporttype enum

Revision ID: e7f8a9b0c1d2
Revises: e6f7a8b9c0d1
Create Date: 2026-04-26

"""

from typing import Sequence, Union

from alembic import op

revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite stores enums as plain text and has no ALTER TYPE — only Postgres
    # needs the new value registered against the enum type.
    if op.get_bind().dialect.name != "postgresql":
        return
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE reporttype ADD VALUE IF NOT EXISTS 'fixmystreet'")


def downgrade() -> None:
    # Postgres has no DROP VALUE for enum types — would require recreating the
    # type and rewriting every dependent column. Left as a no-op intentionally.
    pass
