"""Migration tests — verify every Alembic migration upgrades and downgrades cleanly.

This module:
  1. Steps through each migration one-by-one, asserting the expected schema change.
  2. Downgrades all the way back to base, verifying each step.
  3. Fails if any migration file in alembic/versions/ has no corresponding test,
     so new migrations can never slip in untested.

Requires TEST_DATABASE_URL to point at a PostgreSQL test database.
"""

import os
import re

import pytest
from alembic.config import Config
from alembic.environment import EnvironmentContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERSIONS_DIR = os.path.join(BACKEND_DIR, "alembic", "versions")

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "")

_skip_no_db = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL not set — skipping migration tests",
)


def _alembic_config(connection) -> Config:
    """Return an Alembic Config that reuses the given connection."""
    cfg = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(BACKEND_DIR, "alembic"))
    cfg.attributes["connection"] = connection
    return cfg


def _upgrade(cfg, revision):
    """Upgrade to a specific revision using the shared connection."""
    script = ScriptDirectory.from_config(cfg)
    connection = cfg.attributes["connection"]

    def do_upgrade(rev, context):
        return script._upgrade_revs(revision, rev)

    with EnvironmentContext(cfg, script, fn=do_upgrade, destination_rev=revision) as env:
        env.configure(connection=connection, target_metadata=None)
        with env.begin_transaction():
            env.run_migrations()


def _downgrade(cfg, revision):
    """Downgrade to a specific revision using the shared connection."""
    script = ScriptDirectory.from_config(cfg)
    connection = cfg.attributes["connection"]

    def do_downgrade(rev, context):
        return script._downgrade_revs(revision, rev)

    with EnvironmentContext(cfg, script, fn=do_downgrade, destination_rev=revision) as env:
        env.configure(connection=connection, target_metadata=None)
        with env.begin_transaction():
            env.run_migrations()


def _table_names(connection) -> set[str]:
    return set(inspect(connection).get_table_names())


def _column_names(connection, table: str) -> set[str]:
    return {c["name"] for c in inspect(connection).get_columns(table)}


def _current_rev(connection) -> str | None:
    tables = _table_names(connection)
    if "alembic_version" not in tables:
        return None
    result = connection.execute(text("SELECT version_num FROM alembic_version"))
    row = result.fetchone()
    return row[0] if row else None


def _migration_revisions_on_disk() -> set[str]:
    """Scan alembic/versions/ and return all revision IDs found in filenames."""
    revisions = set()
    for fname in os.listdir(VERSIONS_DIR):
        if fname.endswith(".py") and not fname.startswith("__"):
            match = re.match(r"^([0-9a-f]+)_", fname)
            if match:
                revisions.add(match.group(1))
    return revisions


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _clean_db(connection):
    """Drop and recreate the public schema to get a truly clean slate."""
    connection.execute(text("DROP SCHEMA public CASCADE"))
    connection.execute(text("CREATE SCHEMA public"))
    connection.commit()


@pytest.fixture()
def migration_db():
    """PostgreSQL connection for migration testing. Cleans up before and after each test."""
    engine = create_engine(TEST_DATABASE_URL)
    connection = engine.connect()
    _clean_db(connection)
    yield connection
    connection.rollback()
    _clean_db(connection)
    connection.close()
    engine.dispose()


@pytest.fixture()
def alembic_cfg(migration_db):
    return _alembic_config(migration_db)


# ---------------------------------------------------------------------------
# Per-migration assertions
# ---------------------------------------------------------------------------

from typing import Callable

MIGRATION_CHECKS: dict[str, Callable] = {}


def _check(revision: str):
    """Decorator to register a schema assertion for a migration."""

    def decorator(fn):
        MIGRATION_CHECKS[revision] = fn
        return fn

    return decorator


# 1. b5c96d033e62 — create reports table
@_check("b5c96d033e62")
def _check_create_reports(conn):
    assert "reports" in _table_names(conn)
    cols = _column_names(conn, "reports")
    assert {
        "id",
        "latitude",
        "longitude",
        "description",
        "photo_url",
        "status",
        "created_at",
    } <= cols


# 2. 336a384b8798 — add what3words to reports
@_check("336a384b8798")
def _check_what3words(conn):
    assert "what3words" in _column_names(conn, "reports")


# 3. 6d0d5c38624b — add users table and report_images
@_check("6d0d5c38624b")
def _check_users_and_images(conn):
    tables = _table_names(conn)
    assert "users" in tables
    assert "report_images" in tables

    user_cols = _column_names(conn, "users")
    assert {"id", "email", "full_name", "hashed_password", "user_type", "created_at"} <= user_cols

    img_cols = _column_names(conn, "report_images")
    assert {"id", "report_id", "url", "image_type", "created_at"} <= img_cols

    report_cols = _column_names(conn, "reports")
    assert "created_by_user_id" in report_cols
    assert "resolved_by_user_id" in report_cols
    assert "resolved_at" in report_cols
    assert "photo_url" not in report_cols


# 4. 69e943d78e72 — add thumbnail_url to report_images
@_check("69e943d78e72")
def _check_thumbnail_url(conn):
    assert "thumbnail_url" in _column_names(conn, "report_images")


# 5. ea2fec8170bc — add favourites table
@_check("ea2fec8170bc")
def _check_favourites(conn):
    assert "favourites" in _table_names(conn)
    cols = _column_names(conn, "favourites")
    assert {"id", "user_id", "report_id", "created_at"} <= cols


# 6. 0445d97d2ec1 — add is_verified to users
@_check("0445d97d2ec1")
def _check_is_verified(conn):
    assert "is_verified" in _column_names(conn, "users")


# 7. e44cc152ac4d — add address to reports
@_check("e44cc152ac4d")
def _check_address(conn):
    assert "address" in _column_names(conn, "reports")


# 8. 3b1048682efd — add refresh tokens table
@_check("3b1048682efd")
def _check_refresh_tokens(conn):
    assert "refresh_tokens" in _table_names(conn)
    cols = _column_names(conn, "refresh_tokens")
    assert {"id", "token", "user_id", "expires_at", "revoked", "created_at"} <= cols

    # Verify indexes
    indexes = {idx["name"] for idx in inspect(conn).get_indexes("refresh_tokens")}
    assert "ix_refresh_tokens_id" in indexes
    assert "ix_refresh_tokens_token" in indexes

    # Verify token index is unique
    idx_by_name = {idx["name"]: idx for idx in inspect(conn).get_indexes("refresh_tokens")}
    assert idx_by_name["ix_refresh_tokens_token"]["unique"] is True

    # Verify foreign key to users table
    fks = inspect(conn).get_foreign_keys("refresh_tokens")
    fk_cols = {fk["constrained_columns"][0] for fk in fks}
    assert "user_id" in fk_cols


# 9. 3a9e288db961 — add communities feature (all tables in one migration)
@_check("3a9e288db961")
def _check_communities(conn):
    tables = _table_names(conn)
    assert "communities" in tables
    assert "community_posts" in tables
    assert "community_events" in tables
    assert "event_reports" in tables
    assert "community_memberships" in tables

    # communities columns
    comm_cols = _column_names(conn, "communities")
    assert {
        "id",
        "name",
        "description",
        "facebook_url",
        "profile_image",
        "latitude",
        "longitude",
        "radius_km",
        "owner_id",
        "status",
        "created_at",
    } <= comm_cols

    # community_posts columns
    post_cols = _column_names(conn, "community_posts")
    assert {"id", "community_id", "content", "created_at"} <= post_cols

    # community_events columns
    event_cols = _column_names(conn, "community_events")
    assert {
        "id",
        "community_id",
        "description",
        "date",
        "meeting_latitude",
        "meeting_longitude",
        "created_at",
    } <= event_cols

    # event_reports columns
    er_cols = _column_names(conn, "event_reports")
    assert {"event_id", "report_id"} <= er_cols

    # community_memberships columns
    mem_cols = _column_names(conn, "community_memberships")
    assert {"id", "community_id", "user_id", "status", "created_at", "updated_at"} <= mem_cols

    # Verify foreign keys on communities
    fks = inspect(conn).get_foreign_keys("communities")
    fk_cols = {fk["constrained_columns"][0] for fk in fks}
    assert "owner_id" in fk_cols

    # Verify foreign keys on community_posts
    post_fks = inspect(conn).get_foreign_keys("community_posts")
    post_fk_cols = {fk["constrained_columns"][0] for fk in post_fks}
    assert "community_id" in post_fk_cols

    # Verify foreign keys on community_events
    event_fks = inspect(conn).get_foreign_keys("community_events")
    event_fk_cols = {fk["constrained_columns"][0] for fk in event_fks}
    assert "community_id" in event_fk_cols

    # Verify foreign keys on event_reports
    er_fks = inspect(conn).get_foreign_keys("event_reports")
    er_fk_cols = {fk["constrained_columns"][0] for fk in er_fks}
    assert "event_id" in er_fk_cols
    assert "report_id" in er_fk_cols

    # Verify foreign keys on community_memberships
    mem_fks = inspect(conn).get_foreign_keys("community_memberships")
    mem_fk_cols = {fk["constrained_columns"][0] for fk in mem_fks}
    assert "community_id" in mem_fk_cols
    assert "user_id" in mem_fk_cols


# 10. 190fb0515524 — rename event description to title and add description field
@_check("190fb0515524")
def _check_event_title_and_description(conn):
    event_cols = _column_names(conn, "community_events")
    assert "title" in event_cols
    assert "description" in event_cols


# 11. a1b2c3d4e5f6 — add avatar_url to users
@_check("a1b2c3d4e5f6")
def _check_avatar_url(conn):
    assert "avatar_url" in _column_names(conn, "users")


# 13. c3d4e5f6a7b8 — add city coordinates to users
@_check("c3d4e5f6a7b8")
def _check_city_coordinates(conn):
    user_cols = _column_names(conn, "users")
    assert "city_latitude" in user_cols
    assert "city_longitude" in user_cols


# 14. d4e5f6a7b8c9 — add report_type to reports
@_check("d4e5f6a7b8c9")
def _check_report_type(conn):
    assert "report_type" in _column_names(conn, "reports")


# 12. b2f3a4c5d6e7 — migrate all integer IDs to UUID
@_check("b2f3a4c5d6e7")
def _check_uuid_ids(conn):
    """Verify all primary keys and foreign keys are now UUID type."""
    for table in [
        "users",
        "reports",
        "report_images",
        "communities",
        "community_posts",
        "community_events",
        "community_memberships",
        "favourites",
        "refresh_tokens",
    ]:
        cols = {c["name"]: c for c in inspect(conn).get_columns(table)}
        assert "id" in cols
        assert cols["id"]["type"].__class__.__name__.upper() == "UUID"

    # Check event_reports junction table has UUID columns
    er_cols = {c["name"]: c for c in inspect(conn).get_columns("event_reports")}
    assert er_cols["event_id"]["type"].__class__.__name__.upper() == "UUID"
    assert er_cols["report_id"]["type"].__class__.__name__.upper() == "UUID"


# 14. e5f6a7b8c9d0 — add visibility to communities
@_check("e5f6a7b8c9d0")
def _check_visibility(conn):
    assert "visibility" in _column_names(conn, "communities")


# 15. f6a7b8c9d0e1 — add event attendances table
@_check("f6a7b8c9d0e1")
def _check_event_attendances(conn):
    assert "event_attendances" in _table_names(conn)
    cols = _column_names(conn, "event_attendances")
    assert {"id", "event_id", "user_id", "created_at"} <= cols

    # Verify indexes
    indexes = {idx["name"] for idx in inspect(conn).get_indexes("event_attendances")}
    assert "ix_event_attendances_id" in indexes
    assert "ix_event_attendances_event_id" in indexes
    assert "ix_event_attendances_user_id" in indexes

    # Verify foreign keys
    fks = inspect(conn).get_foreign_keys("event_attendances")
    fk_cols = {fk["constrained_columns"][0] for fk in fks}
    assert "event_id" in fk_cols
    assert "user_id" in fk_cols

    # Verify unique constraint
    uniques = inspect(conn).get_unique_constraints("event_attendances")
    unique_col_sets = [set(u["column_names"]) for u in uniques]
    assert {"event_id", "user_id"} in unique_col_sets


# 16. a7b8c9d0e1f2 — organise images into subdirectories (filesystem only, no schema changes)
@_check("a7b8c9d0e1f2")
def _check_organise_images(conn):
    # This migration only moves files on disk — no schema changes to verify.
    # We just confirm the migration runs without error and the DB state is unchanged.
    tables = _table_names(conn)
    assert "report_images" in tables
    assert "users" in tables
    assert "communities" in tables


# 17. a1b2c3d4e5f7 — add recurrence columns to community_events
@_check("a1b2c3d4e5f7")
def _check_add_recurrence(conn):
    cols = _column_names(conn, "community_events")
    assert "recurrence_rule" in cols
    assert "recurrence_end" in cols
    assert "parent_event_id" in cols
    assert "is_cancelled" in cols


# 18. b2c3d4e5f6a8 — add report status log table and cycle columns
@_check("b2c3d4e5f6a8")
def _check_report_status_log(conn):
    assert "report_status_log" in _table_names(conn)
    cols = _column_names(conn, "report_status_log")
    assert {"id", "report_id", "action", "cycle", "performed_by_user_id", "created_at"} <= cols
    assert "current_cycle" in _column_names(conn, "reports")
    assert "cycle" in _column_names(conn, "report_images")


# 19. c3d4e5f6a7b9 — add report_comments table
@_check("c3d4e5f6a7b9")
def _check_report_comments(conn):
    assert "report_comments" in _table_names(conn)
    cols = _column_names(conn, "report_comments")
    assert {"id", "report_id", "user_id", "body", "created_at"} <= cols

    fks = inspect(conn).get_foreign_keys("report_comments")
    fk_cols = {fk["constrained_columns"][0] for fk in fks}
    assert "report_id" in fk_cols
    assert "user_id" in fk_cols

    indexes = {idx["name"] for idx in inspect(conn).get_indexes("report_comments")}
    assert "ix_report_comments_report_id" in indexes


@_check("c4d5e6f7a8b9")
def _check_stale_enum_values(conn):
    """Verify `stale` and `unstale` are registered on the reportstatusaction enum."""
    result = conn.execute(
        text(
            "SELECT enumlabel FROM pg_enum "
            "JOIN pg_type ON pg_enum.enumtypid = pg_type.oid "
            "WHERE pg_type.typname = 'reportstatusaction'"
        )
    )
    labels = {row[0] for row in result}
    assert {"stale", "unstale"} <= labels


@_check("6f3b919a6597")
def _check_plans_and_plan_reports(conn):
    assert "plans" in _table_names(conn)
    assert "plan_reports" in _table_names(conn)

    plan_cols = _column_names(conn, "plans")
    assert {
        "id",
        "user_id",
        "name",
        "start_latitude",
        "start_longitude",
        "status",
        "total_distance_meters",
        "total_duration_seconds",
        "route_geometry",
        "created_at",
        "updated_at",
    } <= plan_cols

    plan_report_cols = _column_names(conn, "plan_reports")
    assert {
        "id",
        "plan_id",
        "report_id",
        "visit_order",
        "leg_distance_meters",
        "leg_duration_seconds",
    } <= plan_report_cols

    fks = inspect(conn).get_foreign_keys("plans")
    fk_cols = {fk["constrained_columns"][0] for fk in fks}
    assert "user_id" in fk_cols

    fks = inspect(conn).get_foreign_keys("plan_reports")
    fk_cols = {fk["constrained_columns"][0] for fk in fks}
    assert "plan_id" in fk_cols
    assert "report_id" in fk_cols


# ---------------------------------------------------------------------------
# Ordered chain (base → head)
# ---------------------------------------------------------------------------

MIGRATION_CHAIN = [
    "b5c96d033e62",
    "336a384b8798",
    "6d0d5c38624b",
    "69e943d78e72",
    "ea2fec8170bc",
    "0445d97d2ec1",
    "e44cc152ac4d",
    "3b1048682efd",
    "3a9e288db961",
    "190fb0515524",
    "a1b2c3d4e5f6",
    "b2f3a4c5d6e7",
    "c3d4e5f6a7b8",
    "d4e5f6a7b8c9",
    "e5f6a7b8c9d0",
    "f6a7b8c9d0e1",
    "a7b8c9d0e1f2",
    "a1b2c3d4e5f7",
    "b2c3d4e5f6a8",
    "c3d4e5f6a7b9",
    "6f3b919a6597",
    "c4d5e6f7a8b9",
]

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@_skip_no_db
class TestMigrationUpgrades:
    """Step through each migration and verify the schema change."""

    @pytest.mark.parametrize("revision", MIGRATION_CHAIN)
    def test_upgrade(self, migration_db, alembic_cfg, revision):
        idx = MIGRATION_CHAIN.index(revision)
        if idx > 0:
            _upgrade(alembic_cfg, MIGRATION_CHAIN[idx - 1])
        _upgrade(alembic_cfg, revision)

        assert _current_rev(migration_db) == revision
        MIGRATION_CHECKS[revision](migration_db)


@_skip_no_db
class TestFullDowngrade:
    """Upgrade to head, then downgrade all the way back to base."""

    def test_downgrade_to_base(self, migration_db, alembic_cfg):
        # Upgrade to the last reversible migration (before UUID migration)
        last_reversible = "a1b2c3d4e5f6"
        _upgrade(alembic_cfg, last_reversible)
        assert _current_rev(migration_db) == last_reversible

        _downgrade(alembic_cfg, "base")
        assert _current_rev(migration_db) is None

        # Only the alembic_version table should remain (empty)
        tables = _table_names(migration_db) - {"alembic_version"}
        assert tables == set(), f"Tables left after full downgrade: {tables}"

    def test_uuid_migration_downgrade_raises(self, migration_db, alembic_cfg):
        """The UUID migration is intentionally irreversible."""
        _upgrade(alembic_cfg, "head")
        with pytest.raises(NotImplementedError):
            _downgrade(alembic_cfg, "a1b2c3d4e5f6")


@_skip_no_db
class TestFullUpgrade:
    """Upgrade from base to head in one shot."""

    def test_upgrade_to_head(self, migration_db, alembic_cfg):
        _upgrade(alembic_cfg, "head")
        assert _current_rev(migration_db) == MIGRATION_CHAIN[-1]

        tables = _table_names(migration_db) - {"alembic_version"}
        assert {
            "reports",
            "users",
            "report_images",
            "favourites",
            "refresh_tokens",
            "communities",
            "community_posts",
            "community_events",
            "event_reports",
            "community_memberships",
            "event_attendances",
            "report_status_log",
            "report_comments",
            "plans",
            "plan_reports",
        } <= tables


class TestAllMigrationsHaveTests:
    """Fail if any migration on disk is missing from MIGRATION_CHECKS.

    These tests don't need a database — they just compare files on disk
    to the registered checks, so we remove the skipif marker.
    """

    def test_no_untested_migrations(self):
        on_disk = _migration_revisions_on_disk()
        tested = set(MIGRATION_CHECKS.keys())
        untested = on_disk - tested
        assert untested == set(), (
            f"The following migrations have no test assertions: {untested}. "
            f"Add a @_check(revision) function for each one in test_migrations.py."
        )

    def test_no_orphan_tests(self):
        """Catch stale test entries for migrations that no longer exist."""
        on_disk = _migration_revisions_on_disk()
        tested = set(MIGRATION_CHECKS.keys())
        orphaned = tested - on_disk
        assert orphaned == set(), (
            f"Tests exist for migrations that are no longer on disk: {orphaned}. "
            f"Remove the @_check entries from test_migrations.py."
        )

    def test_chain_matches_disk(self):
        """Ensure MIGRATION_CHAIN covers every migration on disk."""
        on_disk = _migration_revisions_on_disk()
        chain = set(MIGRATION_CHAIN)
        missing = on_disk - chain
        assert missing == set(), (
            f"Migrations on disk but not in MIGRATION_CHAIN: {missing}. "
            f"Add them to MIGRATION_CHAIN in test_migrations.py."
        )
