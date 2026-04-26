"""Tests for social-login endpoint (/api/auth/{provider}/login).

Covers the four merge paths plus a regression that password login is correctly
rejected for users that only have a social identity (no hashed_password).
"""

from unittest.mock import patch

import pytest

from app.models.oauth_account import OAuthAccount
from app.models.user import User
from app.services.oauth.base import OAuthIdentity, OAuthVerifyError

from tests.api.conftest import _make_user, auth_header


def _identity(
    *,
    sub: str = "google-sub-1",
    email: str = "alice@example.com",
    email_verified: bool = True,
    full_name: str | None = "Alice Example",
):
    return OAuthIdentity(
        provider="google",
        provider_account_id=sub,
        email=email,
        email_verified=email_verified,
        full_name=full_name,
    )


def _post_google(client, identity: OAuthIdentity, credential: str = "fake-id-token"):
    """Hit /api/auth/google/login with a stubbed verifier returning `identity`."""
    with patch(
        "app.services.oauth.google.GoogleVerifier.verify",
        return_value=identity,
    ):
        return client.post(
            "/api/auth/google/login",
            json={"credential": credential},
        )


class TestSocialLoginPaths:
    """The four merge paths that decide what happens when a Google ID token arrives."""

    def test_path1_new_user_is_created(self, client, db):
        """No existing user with this email -> create a new verified social-only user."""
        identity = _identity(email="newbie@example.com", sub="g-1")
        res = _post_google(client, identity)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["access_token"]
        assert body["refresh_token"]

        user = db.query(User).filter(User.email == "newbie@example.com").one()
        assert user.is_verified is True
        assert user.hashed_password is None
        assert user.full_name == "Alice Example"
        link = db.query(OAuthAccount).filter(OAuthAccount.user_id == user.id).one()
        assert link.provider == "google"
        assert link.provider_account_id == "g-1"

    def test_path2_auto_merge_with_verified_password_user(self, client, db):
        """Verified password user with same email -> auto-link, do not duplicate."""
        existing = _make_user(
            db,
            email="alice@example.com",
            password="my-password",
            is_verified=True,
        )
        identity = _identity(email="alice@example.com", sub="g-2")
        res = _post_google(client, identity)
        assert res.status_code == 200, res.text

        # Same user, password preserved, oauth row attached
        users = db.query(User).filter(User.email == "alice@example.com").all()
        assert len(users) == 1
        assert users[0].id == existing.id
        assert users[0].hashed_password is not None  # password login still works
        link = db.query(OAuthAccount).filter(OAuthAccount.user_id == existing.id).one()
        assert link.provider_account_id == "g-2"

    def test_path3_unverified_password_user_is_rejected(self, client, db):
        """Unverified password user with same email -> 409 (takeover protection)."""
        _make_user(
            db,
            email="bob@example.com",
            password="bob-password",
            is_verified=False,
        )
        identity = _identity(email="bob@example.com", sub="g-3")
        res = _post_google(client, identity)
        assert res.status_code == 409
        # And no oauth row was created
        assert db.query(OAuthAccount).count() == 0

    def test_path4_existing_linked_user_signs_in_again(self, client, db):
        """Already-linked user -> just sign in, no duplicate oauth row."""
        existing = _make_user(db, email="carol@example.com", is_verified=True)
        db.add(
            OAuthAccount(
                user_id=existing.id,
                provider="google",
                provider_account_id="g-4",
            )
        )
        db.commit()

        identity = _identity(email="carol@example.com", sub="g-4")
        res = _post_google(client, identity)
        assert res.status_code == 200, res.text

        # Still exactly one link row
        rows = db.query(OAuthAccount).filter(OAuthAccount.user_id == existing.id).all()
        assert len(rows) == 1


class TestSocialLoginGuards:
    def test_unverified_email_from_provider_is_rejected(self, client, db):
        """Provider returned email_verified=false -> reject before any DB write."""
        identity = _identity(email="spoof@example.com", email_verified=False)
        res = _post_google(client, identity)
        assert res.status_code == 400
        assert db.query(User).count() == 0

    def test_unsupported_provider_returns_400(self, client):
        res = client.post(
            "/api/auth/facebook/login",
            json={"credential": "anything"},
        )
        assert res.status_code == 400

    def test_invalid_credential_returns_401(self, client, db):
        with patch(
            "app.services.oauth.google.GoogleVerifier.verify",
            side_effect=OAuthVerifyError("bad signature"),
        ):
            res = client.post(
                "/api/auth/google/login",
                json={"credential": "tampered"},
            )
        assert res.status_code == 401
        assert db.query(User).count() == 0


class TestPasswordLoginForSocialOnlyUser:
    """Regression: password login must not accept social-only users (no hashed_password)."""

    def test_password_login_rejected_when_user_has_no_password(self, client, db):
        # Create a social-only user via the social-login path
        identity = _identity(email="social@example.com", sub="g-only")
        _post_google(client, identity)

        # Now try to log in with /api/auth/login using any password
        res = client.post(
            "/api/auth/login",
            json={"email": "social@example.com", "password": "guess"},
        )
        assert res.status_code == 401


def _post_link(client, user, identity: OAuthIdentity, credential: str = "fake-id-token"):
    with patch(
        "app.services.oauth.google.GoogleVerifier.verify",
        return_value=identity,
    ):
        return client.post(
            "/api/auth/google/link",
            json={"credential": credential},
            headers=auth_header(user),
        )


class TestLinkProvider:
    def test_link_success_attaches_to_current_user(self, client, db, volunteer):
        identity = _identity(email=volunteer.email, sub="g-link-1")
        res = _post_link(client, volunteer, identity)
        assert res.status_code == 200, res.text
        body = res.json()
        assert "google" in body["linked_providers"]
        assert body["has_password"] is True

        link = (
            db.query(OAuthAccount)
            .filter(OAuthAccount.user_id == volunteer.id, OAuthAccount.provider == "google")
            .one()
        )
        assert link.provider_account_id == "g-link-1"

    def test_link_is_idempotent_for_same_user(self, client, db, volunteer):
        identity = _identity(sub="g-link-2")
        first = _post_link(client, volunteer, identity)
        assert first.status_code == 200
        second = _post_link(client, volunteer, identity)
        assert second.status_code == 200

        # Still exactly one link row
        rows = db.query(OAuthAccount).filter(OAuthAccount.user_id == volunteer.id).all()
        assert len(rows) == 1

    def test_link_conflict_when_owned_by_other_user(self, client, db, volunteer):
        other = _make_user(db, email="other@example.com")
        db.add(
            OAuthAccount(
                user_id=other.id,
                provider="google",
                provider_account_id="g-conflict",
            )
        )
        db.commit()

        identity = _identity(sub="g-conflict")
        res = _post_link(client, volunteer, identity)
        assert res.status_code == 409
        # Volunteer remains unlinked
        assert db.query(OAuthAccount).filter(OAuthAccount.user_id == volunteer.id).count() == 0

    def test_link_rejects_unverified_provider_email(self, client, db, volunteer):
        identity = _identity(sub="g-unverified", email_verified=False)
        res = _post_link(client, volunteer, identity)
        assert res.status_code == 400
        assert db.query(OAuthAccount).filter(OAuthAccount.user_id == volunteer.id).count() == 0

    def test_link_requires_authentication(self, client):
        res = client.post(
            "/api/auth/google/link",
            json={"credential": "anything"},
        )
        assert res.status_code == 401

    def test_link_unsupported_provider(self, client, volunteer):
        res = client.post(
            "/api/auth/facebook/link",
            json={"credential": "anything"},
            headers=auth_header(volunteer),
        )
        assert res.status_code == 400


class TestUnlinkProvider:
    def test_unlink_removes_the_link(self, client, db, volunteer):
        db.add(
            OAuthAccount(
                user_id=volunteer.id,
                provider="google",
                provider_account_id="g-unlink-1",
            )
        )
        db.commit()

        res = client.delete(
            "/api/auth/google/link",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 200, res.text
        assert "google" not in res.json()["linked_providers"]
        assert db.query(OAuthAccount).filter(OAuthAccount.user_id == volunteer.id).count() == 0

    def test_unlink_404_when_not_linked(self, client, volunteer):
        res = client.delete(
            "/api/auth/google/link",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 404

    def test_unlink_blocked_for_social_only_user(self, client, db):
        """A user with no password whose only sign-in is Google must not be left orphaned."""
        identity = _identity(email="social@example.com", sub="g-only-link")
        login_res = _post_google(client, identity)
        assert login_res.status_code == 200

        social_user = db.query(User).filter(User.email == "social@example.com").one()
        assert social_user.hashed_password is None

        res = client.delete(
            "/api/auth/google/link",
            headers=auth_header(social_user),
        )
        assert res.status_code == 409
        # Link must still exist
        assert db.query(OAuthAccount).filter(OAuthAccount.user_id == social_user.id).count() == 1

    def test_unlink_requires_authentication(self, client):
        res = client.delete("/api/auth/google/link")
        assert res.status_code == 401


class TestUserReadIncludesLinkState:
    def test_me_returns_linked_providers_and_has_password(self, client, db, volunteer):
        db.add(
            OAuthAccount(
                user_id=volunteer.id,
                provider="google",
                provider_account_id="g-me",
            )
        )
        db.commit()

        res = client.get("/api/auth/me", headers=auth_header(volunteer))
        assert res.status_code == 200
        body = res.json()
        assert body["linked_providers"] == ["google"]
        assert body["has_password"] is True

    def test_me_for_social_only_user_reports_no_password(self, client, db):
        identity = _identity(email="onlygoogle@example.com", sub="g-me-only")
        _post_google(client, identity)
        social_user = db.query(User).filter(User.email == "onlygoogle@example.com").one()

        res = client.get("/api/auth/me", headers=auth_header(social_user))
        assert res.status_code == 200
        body = res.json()
        assert body["has_password"] is False
        assert body["linked_providers"] == ["google"]
