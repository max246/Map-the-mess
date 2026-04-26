"""add oauth_accounts table and make hashed_password nullable

Revision ID: e6f7a8b9c0d1
Revises: d463788ee99d
Create Date: 2026-04-26

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, None] = "d463788ee99d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("hashed_password", existing_type=sa.String(), nullable=True)

    op.create_table(
        "oauth_accounts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("provider_account_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "provider_account_id", name="uq_oauth_provider_account"),
    )
    op.create_index(op.f("ix_oauth_accounts_id"), "oauth_accounts", ["id"])
    op.create_index(op.f("ix_oauth_accounts_user_id"), "oauth_accounts", ["user_id"])
    op.create_index(op.f("ix_oauth_accounts_provider"), "oauth_accounts", ["provider"])


def downgrade() -> None:
    op.drop_index(op.f("ix_oauth_accounts_provider"), table_name="oauth_accounts")
    op.drop_index(op.f("ix_oauth_accounts_user_id"), table_name="oauth_accounts")
    op.drop_index(op.f("ix_oauth_accounts_id"), table_name="oauth_accounts")
    op.drop_table("oauth_accounts")

    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("hashed_password", existing_type=sa.String(), nullable=False)
