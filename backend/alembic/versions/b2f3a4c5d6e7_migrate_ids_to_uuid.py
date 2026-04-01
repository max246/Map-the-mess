"""migrate all integer IDs to UUID

Revision ID: b2f3a4c5d6e7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-01 18:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "b2f3a4c5d6e7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Tables with their primary key and foreign keys that reference other tables.
# Format: (table, pk_column, [(fk_column, referenced_table)])
TABLES = [
    ("users", "id", []),
    (
        "reports",
        "id",
        [
            ("created_by_user_id", "users"),
            ("resolved_by_user_id", "users"),
        ],
    ),
    (
        "report_images",
        "id",
        [
            ("report_id", "reports"),
        ],
    ),
    (
        "communities",
        "id",
        [
            ("owner_id", "users"),
        ],
    ),
    (
        "community_posts",
        "id",
        [
            ("community_id", "communities"),
        ],
    ),
    (
        "community_events",
        "id",
        [
            ("community_id", "communities"),
        ],
    ),
    (
        "community_memberships",
        "id",
        [
            ("community_id", "communities"),
            ("user_id", "users"),
        ],
    ),
    (
        "favourites",
        "id",
        [
            ("user_id", "users"),
            ("report_id", "reports"),
        ],
    ),
    (
        "refresh_tokens",
        "id",
        [
            ("user_id", "users"),
        ],
    ),
]

# Junction table (no own PK, composite FK)
JUNCTION = (
    "event_reports",
    [
        ("event_id", "community_events"),
        ("report_id", "reports"),
    ],
)

ALL_TABLE_NAMES = [t for t, _, _ in TABLES] + [JUNCTION[0]]


def _drop_all_constraints(conn):
    """Dynamically discover and drop ALL FK, PK, and unique constraints on all affected tables."""
    for table in ALL_TABLE_NAMES:
        # Get all constraints: f=FK, p=PK, u=unique
        rows = conn.execute(
            sa.text(
                f"SELECT conname, contype FROM pg_constraint "
                f"WHERE conrelid = '{table}'::regclass AND contype IN ('f', 'p', 'u')"
            )
        ).fetchall()
        for name, _contype in rows:
            op.execute(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {name} CASCADE")


def _drop_all_indexes(conn):
    """Drop all indexes on the old integer id/fk columns."""
    for table in ALL_TABLE_NAMES:
        rows = conn.execute(
            sa.text(
                f"SELECT indexname FROM pg_indexes "
                f"WHERE tablename = '{table}' AND indexname != '{table}_pkey'"
            )
        ).fetchall()
        for (indexname,) in rows:
            op.execute(f"DROP INDEX IF EXISTS {indexname} CASCADE")


def upgrade() -> None:
    conn = op.get_bind()

    # Enable uuid extension
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # --- Step 1: Add new UUID columns for all PKs ---
    for table, pk, _fks in TABLES:
        op.add_column(
            table,
            sa.Column("new_id", UUID(as_uuid=True), server_default=sa.text("uuid_generate_v4()")),
        )
        op.execute(f"UPDATE {table} SET new_id = uuid_generate_v4() WHERE new_id IS NULL")

    # --- Step 2: Add new UUID FK columns and populate via join ---
    for table, _pk, fks in TABLES:
        for fk_col, ref_table in fks:
            new_fk_col = f"new_{fk_col}"
            op.add_column(table, sa.Column(new_fk_col, UUID(as_uuid=True), nullable=True))
            op.execute(
                f"UPDATE {table} SET {new_fk_col} = ref.new_id "
                f"FROM {ref_table} ref WHERE {table}.{fk_col} = ref.id"
            )

    # Junction table
    junc_table, junc_fks = JUNCTION
    for fk_col, ref_table in junc_fks:
        new_fk_col = f"new_{fk_col}"
        op.add_column(junc_table, sa.Column(new_fk_col, UUID(as_uuid=True), nullable=True))
        op.execute(
            f"UPDATE {junc_table} SET {new_fk_col} = ref.new_id "
            f"FROM {ref_table} ref WHERE {junc_table}.{fk_col} = ref.id"
        )

    # --- Step 3: Drop ALL constraints and indexes first ---
    _drop_all_constraints(conn)
    _drop_all_indexes(conn)

    # --- Step 4: Swap columns on junction table ---
    op.drop_column("event_reports", "event_id")
    op.drop_column("event_reports", "report_id")
    op.alter_column("event_reports", "new_event_id", new_column_name="event_id", nullable=False)
    op.alter_column("event_reports", "new_report_id", new_column_name="report_id", nullable=False)

    # --- Step 5: Swap columns on all tables ---
    for table, pk, fks in TABLES:
        # Drop old FK columns, rename new ones
        for fk_col, _ref_table in fks:
            op.drop_column(table, fk_col)
            op.alter_column(table, f"new_{fk_col}", new_column_name=fk_col)

        # Drop old PK column, rename new one
        op.drop_column(table, "id")
        op.alter_column(table, "new_id", new_column_name="id", nullable=False)
        op.alter_column(table, "id", server_default=None)

    # --- Step 6: Recreate primary keys ---
    for table, _pk, _fks in TABLES:
        op.create_primary_key(f"{table}_pkey", table, ["id"])

    op.create_primary_key("event_reports_pkey", "event_reports", ["event_id", "report_id"])

    # --- Step 7: Recreate foreign key constraints ---
    for table, _pk, fks in TABLES:
        for fk_col, ref_table in fks:
            op.create_foreign_key(
                f"{table}_{fk_col}_fkey",
                table,
                ref_table,
                [fk_col],
                ["id"],
                ondelete="CASCADE" if _has_cascade(table, fk_col) else None,
            )

    op.create_foreign_key(
        "event_reports_event_id_fkey",
        "event_reports",
        "community_events",
        ["event_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "event_reports_report_id_fkey",
        "event_reports",
        "reports",
        ["report_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # --- Step 8: Recreate indexes ---
    for table, _pk, fks in TABLES:
        op.create_index(f"ix_{table}_id", table, ["id"])
        for fk_col, _ref_table in fks:
            if _has_index(table, fk_col):
                op.create_index(f"ix_{table}_{fk_col}", table, [fk_col])

    # --- Step 9: Recreate unique constraints ---
    op.create_unique_constraint("uq_user_report", "favourites", ["user_id", "report_id"])
    op.create_unique_constraint(
        "uq_community_user", "community_memberships", ["community_id", "user_id"]
    )


def _has_cascade(table: str, fk_col: str) -> bool:
    """Columns that had CASCADE on delete in the original schema."""
    no_cascade = {("reports", "created_by_user_id"), ("reports", "resolved_by_user_id")}
    return (table, fk_col) not in no_cascade


def _has_index(table: str, fk_col: str) -> bool:
    """FK columns that had an explicit index in the original schema."""
    indexed = {
        ("report_images", "report_id"),
        ("communities", "owner_id"),
        ("community_posts", "community_id"),
        ("community_events", "community_id"),
        ("community_memberships", "community_id"),
        ("community_memberships", "user_id"),
        ("favourites", "user_id"),
        ("favourites", "report_id"),
    }
    return (table, fk_col) in indexed


def downgrade() -> None:
    raise NotImplementedError("Downgrade from UUID to integer IDs is not supported")
