"""add stale and unstale to reportstatusaction enum

Revision ID: c4d5e6f7a8b9
Revises: 6f3b919a6597
Create Date: 2026-04-17

"""

from typing import Sequence, Union

from alembic import op

revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, None] = "6f3b919a6597"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite stores enums as plain text and has no ALTER TYPE — only Postgres
    # needs the new values registered against the enum type.
    if op.get_bind().dialect.name != "postgresql":
        return
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE reportstatusaction ADD VALUE IF NOT EXISTS 'stale'")
        op.execute("ALTER TYPE reportstatusaction ADD VALUE IF NOT EXISTS 'unstale'")


def downgrade() -> None:
    # Postgres has no DROP VALUE for enum types — would require recreating the
    # type and rewriting every dependent column. Left as a no-op intentionally.
    pass
