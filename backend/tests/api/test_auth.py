"""Tests for auth endpoints (/api/auth)."""

from unittest.mock import patch

from app.models.user import User, UserType
from app.routers.auth import pwd_context

from tests.api.conftest import auth_header, _make_user


class TestRegister:
    def test_register_success(self, client, db):
        with patch("app.routers.auth._send_verification_email"):
            res = client.post(
                "/api/auth/register",
                json={
                    "email": "new@example.com",
                    "full_name": "New User",
                    "password": "securepass",
                },
            )
        assert res.status_code == 200
        data = res.json()
        assert data["email"] == "new@example.com"
        assert data["full_name"] == "New User"
        assert data["is_verified"] is False
        assert data["user_type"] == "volunteer"

    def test_register_duplicate_email(self, client, db, volunteer):
        with patch("app.routers.auth._send_verification_email"):
            res = client.post(
                "/api/auth/register",
                json={
                    "email": volunteer.email,
                    "full_name": "Dup",
                    "password": "pass",
                },
            )
        assert res.status_code == 400
        assert "already registered" in res.json()["detail"]

    def test_register_invalid_email(self, client, db):
        res = client.post(
            "/api/auth/register",
            json={"email": "not-an-email", "full_name": "X", "password": "pass"},
        )
        assert res.status_code == 422


class TestLogin:
    def test_login_success(self, client, db, volunteer):
        res = client.post(
            "/api/auth/login",
            json={"email": volunteer.email, "password": "testpass123"},
        )
        assert res.status_code == 200
        assert "access_token" in res.json()

    def test_login_wrong_password(self, client, db, volunteer):
        res = client.post(
            "/api/auth/login",
            json={"email": volunteer.email, "password": "wrong"},
        )
        assert res.status_code == 401

    def test_login_nonexistent_user(self, client, db):
        res = client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "pass"},
        )
        assert res.status_code == 401

    def test_login_unverified_user(self, client, db):
        _make_user(db, email="unverified@example.com", is_verified=False)
        res = client.post(
            "/api/auth/login",
            json={"email": "unverified@example.com", "password": "testpass123"},
        )
        assert res.status_code == 403
        assert "not verified" in res.json()["detail"]


class TestVerifyEmail:
    def test_verify_valid_token(self, client, db):
        from jose import jwt
        from datetime import datetime, timedelta, timezone
        from app.config import SECRET_KEY
        from app.routers.auth import ALGORITHM

        user = _make_user(db, email="verify@example.com", is_verified=False)
        token = jwt.encode(
            {
                "sub": user.email,
                "purpose": "email-verification",
                "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            },
            SECRET_KEY,
            algorithm=ALGORITHM,
        )
        res = client.get(f"/api/auth/verify?token={token}")
        assert res.status_code == 200
        assert "verified" in res.json()["message"].lower()

    def test_verify_invalid_token(self, client, db):
        res = client.get("/api/auth/verify?token=bad-token")
        assert res.status_code == 400

    def test_verify_already_verified(self, client, db, volunteer):
        from jose import jwt
        from datetime import datetime, timedelta, timezone
        from app.config import SECRET_KEY
        from app.routers.auth import ALGORITHM

        token = jwt.encode(
            {
                "sub": volunteer.email,
                "purpose": "email-verification",
                "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            },
            SECRET_KEY,
            algorithm=ALGORITHM,
        )
        res = client.get(f"/api/auth/verify?token={token}")
        assert res.status_code == 200
        assert "already" in res.json()["message"].lower()


class TestResendVerification:
    def test_resend_always_returns_ok(self, client, db):
        """Endpoint never reveals whether the email exists."""
        with patch("app.routers.auth._send_verification_email"):
            res = client.post(
                "/api/auth/resend-verification",
                json={"email": "nobody@example.com"},
            )
        assert res.status_code == 200


class TestListUsers:
    def test_admin_can_list(self, client, db, admin):
        res = client.get("/api/auth/users", headers=auth_header(admin))
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_volunteer_cannot_list(self, client, db, volunteer):
        res = client.get("/api/auth/users", headers=auth_header(volunteer))
        assert res.status_code == 403

    def test_unauthenticated_cannot_list(self, client, db):
        res = client.get("/api/auth/users")
        assert res.status_code == 401


class TestUpdateUserType:
    def test_admin_can_change_role(self, client, db, admin, volunteer):
        res = client.patch(
            f"/api/auth/users/{volunteer.id}/type",
            json={"user_type": "moderator"},
            headers=auth_header(admin),
        )
        assert res.status_code == 200
        assert res.json()["user_type"] == "moderator"

    def test_cannot_change_superuser_type(self, client, db, admin, superuser):
        res = client.patch(
            f"/api/auth/users/{superuser.id}/type",
            json={"user_type": "volunteer"},
            headers=auth_header(admin),
        )
        assert res.status_code == 403

    def test_volunteer_cannot_change_role(self, client, db, volunteer):
        res = client.patch(
            f"/api/auth/users/{volunteer.id}/type",
            json={"user_type": "admin"},
            headers=auth_header(volunteer),
        )
        assert res.status_code == 403

    def test_change_nonexistent_user(self, client, db, admin):
        res = client.patch(
            "/api/auth/users/9999/type",
            json={"user_type": "moderator"},
            headers=auth_header(admin),
        )
        assert res.status_code == 404


class TestDeleteUser:
    def test_admin_can_delete_volunteer(self, client, db, admin, volunteer):
        res = client.delete(
            f"/api/auth/users/{volunteer.id}",
            headers=auth_header(admin),
        )
        assert res.status_code == 204

    def test_cannot_delete_superuser(self, client, db, admin, superuser):
        res = client.delete(
            f"/api/auth/users/{superuser.id}",
            headers=auth_header(admin),
        )
        assert res.status_code == 403

    def test_admin_cannot_delete_admin(self, client, db, admin):
        other_admin = _make_user(db, email="admin2@example.com", user_type=UserType.admin)
        res = client.delete(
            f"/api/auth/users/{other_admin.id}",
            headers=auth_header(admin),
        )
        assert res.status_code == 403

    def test_superuser_can_delete_admin(self, client, db, superuser, admin):
        res = client.delete(
            f"/api/auth/users/{admin.id}",
            headers=auth_header(superuser),
        )
        assert res.status_code == 204

    def test_delete_nonexistent_user(self, client, db, admin):
        res = client.delete(
            "/api/auth/users/9999",
            headers=auth_header(admin),
        )
        assert res.status_code == 404


class TestForgotPassword:
    def test_always_returns_ok(self, client, db):
        with patch("app.routers.auth.send_email"):
            res = client.post(
                "/api/auth/forgot-password",
                json={"email": "nobody@example.com"},
            )
        assert res.status_code == 200


class TestResetPassword:
    def test_reset_with_valid_token(self, client, db, volunteer):
        from jose import jwt
        from datetime import datetime, timedelta, timezone
        from app.config import SECRET_KEY
        from app.routers.auth import ALGORITHM

        token = jwt.encode(
            {
                "sub": volunteer.email,
                "purpose": "password-reset",
                "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
            },
            SECRET_KEY,
            algorithm=ALGORITHM,
        )
        res = client.post(
            "/api/auth/reset-password",
            json={"token": token, "new_password": "newpass123"},
        )
        assert res.status_code == 200

        # Verify the password actually changed
        db.refresh(volunteer)
        assert pwd_context.verify("newpass123", volunteer.hashed_password)

    def test_reset_with_invalid_token(self, client, db):
        res = client.post(
            "/api/auth/reset-password",
            json={"token": "bad", "new_password": "x"},
        )
        assert res.status_code == 400
