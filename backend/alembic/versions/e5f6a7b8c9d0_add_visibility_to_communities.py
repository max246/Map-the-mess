"""add visibility to communities

Revision ID: e5f6a7b8c9d0
Revises: c3d4e5f6a7b8
Create Date: 2026-04-08

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

community_visibility_enum = sa.Enum("public", "private", name="communityvisibility")


def upgrade() -> None:
    community_visibility_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "communities",
        sa.Column(
            "visibility",
            community_visibility_enum,
            nullable=True,
        ),
    )
    # Backfill existing communities as private
    op.execute("UPDATE communities SET visibility = 'private' WHERE visibility IS NULL")
    with op.batch_alter_table("communities") as batch_op:
        batch_op.alter_column("visibility", nullable=False)


def downgrade() -> None:
    op.drop_column("communities", "visibility")
    community_visibility_enum.drop(op.get_bind(), checkfirst=True)
