"""add raffles feature

Revision ID: a9b8c7d6e5f4
Revises: f8a9b0c1d2e3
Create Date: 2026-05-03

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "a9b8c7d6e5f4"
down_revision: Union[str, None] = "f8a9b0c1d2e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "raffles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("end_date", sa.DateTime(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("drawn_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_raffles_id"), "raffles", ["id"])
    op.create_index(op.f("ix_raffles_created_by"), "raffles", ["created_by"])

    op.create_table(
        "raffle_prizes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("raffle_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("winner_user_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["raffle_id"], ["raffles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["winner_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_raffle_prizes_id"), "raffle_prizes", ["id"])
    op.create_index(op.f("ix_raffle_prizes_raffle_id"), "raffle_prizes", ["raffle_id"])
    op.create_index(op.f("ix_raffle_prizes_winner_user_id"), "raffle_prizes", ["winner_user_id"])

    op.create_table(
        "raffle_prize_images",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("prize_id", sa.Uuid(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["prize_id"], ["raffle_prizes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_raffle_prize_images_id"), "raffle_prize_images", ["id"])
    op.create_index(op.f("ix_raffle_prize_images_prize_id"), "raffle_prize_images", ["prize_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_raffle_prize_images_prize_id"), table_name="raffle_prize_images")
    op.drop_index(op.f("ix_raffle_prize_images_id"), table_name="raffle_prize_images")
    op.drop_table("raffle_prize_images")

    op.drop_index(op.f("ix_raffle_prizes_winner_user_id"), table_name="raffle_prizes")
    op.drop_index(op.f("ix_raffle_prizes_raffle_id"), table_name="raffle_prizes")
    op.drop_index(op.f("ix_raffle_prizes_id"), table_name="raffle_prizes")
    op.drop_table("raffle_prizes")

    op.drop_index(op.f("ix_raffles_created_by"), table_name="raffles")
    op.drop_index(op.f("ix_raffles_id"), table_name="raffles")
    op.drop_table("raffles")
