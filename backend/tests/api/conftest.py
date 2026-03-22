"""Shared fixtures for API tests."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models.user import User, UserType
from app.routers.auth import pwd_context, create_access_token

# Prevent the lifespan superuser seed from running during tests
with patch("main._seed_superuser"):
    from main import app


@pytest.fixture()
def db():
    """Create a fresh in-memory SQLite database for each test."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Enable foreign key enforcement for SQLite
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db):
    """FastAPI test client wired to the test database."""

    def _override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Helper factories
# ---------------------------------------------------------------------------


def _make_user(
    db,
    *,
    email: str = "user@example.com",
    full_name: str = "Test User",
    password: str = "testpass123",
    user_type: UserType = UserType.volunteer,
    is_verified: bool = True,
) -> User:
    user = User(
        email=email,
        full_name=full_name,
        hashed_password=pwd_context.hash(password),
        user_type=user_type,
        is_verified=is_verified,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def volunteer(db):
    return _make_user(db, email="volunteer@example.com", user_type=UserType.volunteer)


@pytest.fixture()
def moderator(db):
    return _make_user(db, email="mod@example.com", user_type=UserType.moderator)


@pytest.fixture()
def admin(db):
    return _make_user(db, email="admin@example.com", user_type=UserType.admin)


@pytest.fixture()
def superuser(db):
    return _make_user(db, email="super@example.com", user_type=UserType.superuser)


def auth_header(user: User) -> dict[str, str]:
    """Return an Authorization header dict for the given user."""
    token = create_access_token({"sub": user.email, "type": user.user_type.value})
    return {"Authorization": f"Bearer {token}"}
