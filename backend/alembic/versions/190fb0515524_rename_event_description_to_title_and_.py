"""rename event description to title and add description field

Revision ID: 190fb0515524
Revises: 3a9e288db961
Create Date: 2026-03-28 14:23:32.461910

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "190fb0515524"
down_revision: Union[str, None] = "3a9e288db961"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add title as nullable first so existing rows don't break
    op.add_column("community_events", sa.Column("title", sa.String(), nullable=True))
    # Copy existing description values into the new title column
    op.execute("UPDATE community_events SET title = description")
    # Now make title non-nullable
    with op.batch_alter_table("community_events") as batch_op:
        batch_op.alter_column("title", nullable=False)
    # Make description nullable (it's now a separate optional field)
    with op.batch_alter_table("community_events") as batch_op:
        batch_op.alter_column("description", existing_type=sa.VARCHAR(), nullable=True)


def downgrade() -> None:
    # Copy title back to description for any rows where description is null
    op.execute("UPDATE community_events SET description = title WHERE description IS NULL")
    with op.batch_alter_table("community_events") as batch_op:
        batch_op.alter_column("description", existing_type=sa.VARCHAR(), nullable=False)
    op.drop_column("community_events", "title")
