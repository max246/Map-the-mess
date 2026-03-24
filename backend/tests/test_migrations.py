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
        _upgrade(alembic_cfg, "head")
        assert _current_rev(migration_db) == MIGRATION_CHAIN[-1]

        _downgrade(alembic_cfg, "base")
        assert _current_rev(migration_db) is None

        # Only the alembic_version table should remain (empty)
        tables = _table_names(migration_db) - {"alembic_version"}
        assert tables == set(), f"Tables left after full downgrade: {tables}"


@_skip_no_db
class TestFullUpgrade:
    """Upgrade from base to head in one shot."""

    def test_upgrade_to_head(self, migration_db, alembic_cfg):
        _upgrade(alembic_cfg, "head")
        assert _current_rev(migration_db) == MIGRATION_CHAIN[-1]

        tables = _table_names(migration_db) - {"alembic_version"}
        assert {"reports", "users", "report_images", "favourites", "refresh_tokens"} <= tables


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
