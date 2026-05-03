"""Tests for the raffle API."""

import uuid
from datetime import datetime, timedelta, timezone
from io import BytesIO
from unittest.mock import patch

from PIL import Image as PILImage

from app.models.raffle import Raffle, RafflePrize, RafflePrizeImage
from app.models.user import UserType
from tests.api.conftest import _make_user, auth_header


def _make_upload_image() -> BytesIO:
    buf = BytesIO()
    img = PILImage.new("RGB", (400, 400), color="blue")
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf


def _create_raffle(db, *, title="Spring Raffle", end_in_days=30) -> Raffle:
    raffle = Raffle(
        title=title,
        description="Test raffle",
        end_date=datetime.now(timezone.utc) + timedelta(days=end_in_days),
    )
    db.add(raffle)
    db.commit()
    db.refresh(raffle)
    return raffle


def _add_prize(db, raffle, *, title="Prize", position=1) -> RafflePrize:
    prize = RafflePrize(raffle_id=raffle.id, title=title, description="", position=position)
    db.add(prize)
    db.commit()
    db.refresh(prize)
    return prize


# ---------------------------------------------------------------------------
# Listing & detail (public)
# ---------------------------------------------------------------------------


class TestListAndGet:
    def test_list_anon(self, client, db):
        _create_raffle(db, title="A")
        _create_raffle(db, title="B")
        res = client.get("/api/raffles/")
        assert res.status_code == 200
        assert len(res.json()) == 2

    def test_list_empty(self, client, db):
        res = client.get("/api/raffles/")
        assert res.status_code == 200
        assert res.json() == []

    def test_get_anon(self, client, db):
        r = _create_raffle(db)
        _add_prize(db, r)
        res = client.get(f"/api/raffles/{r.id}")
        assert res.status_code == 200
        body = res.json()
        assert body["title"] == "Spring Raffle"
        assert len(body["prizes"]) == 1

    def test_get_nonexistent(self, client, db):
        res = client.get("/api/raffles/00000000-0000-0000-0000-000000000000")
        assert res.status_code == 404


# ---------------------------------------------------------------------------
# Create / update / delete (admin-only)
# ---------------------------------------------------------------------------


class TestCreateRaffle:
    def test_admin_creates(self, client, db, admin):
        end = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
        res = client.post(
            "/api/raffles/",
            json={"title": "T", "description": "D", "end_date": end},
            headers=auth_header(admin),
        )
        assert res.status_code == 201
        body = res.json()
        assert body["title"] == "T"
        assert body["created_by"] == str(admin.id)
        assert body["drawn_at"] is None

    def test_volunteer_forbidden(self, client, db, volunteer):
        end = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
        res = client.post(
            "/api/raffles/",
            json={"title": "T", "end_date": end},
            headers=auth_header(volunteer),
        )
        assert res.status_code == 403

    def test_moderator_forbidden(self, client, db, moderator):
        end = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
        res = client.post(
            "/api/raffles/",
            json={"title": "T", "end_date": end},
            headers=auth_header(moderator),
        )
        assert res.status_code == 403

    def test_anon_unauthorized(self, client, db):
        end = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
        res = client.post("/api/raffles/", json={"title": "T", "end_date": end})
        assert res.status_code == 401

    def test_superuser_can_create(self, client, db, superuser):
        end = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
        res = client.post(
            "/api/raffles/",
            json={"title": "T", "end_date": end},
            headers=auth_header(superuser),
        )
        assert res.status_code == 201


class TestUpdateRaffle:
    def test_admin_updates(self, client, db, admin):
        r = _create_raffle(db)
        res = client.patch(
            f"/api/raffles/{r.id}",
            json={"title": "Updated"},
            headers=auth_header(admin),
        )
        assert res.status_code == 200
        assert res.json()["title"] == "Updated"

    def test_cannot_update_after_draw(self, client, db, admin):
        r = _create_raffle(db)
        r.drawn_at = datetime.utcnow()
        db.commit()
        res = client.patch(
            f"/api/raffles/{r.id}",
            json={"title": "Nope"},
            headers=auth_header(admin),
        )
        assert res.status_code == 400

    def test_volunteer_forbidden(self, client, db, volunteer):
        r = _create_raffle(db)
        res = client.patch(
            f"/api/raffles/{r.id}",
            json={"title": "x"},
            headers=auth_header(volunteer),
        )
        assert res.status_code == 403


class TestDeleteRaffle:
    def test_admin_deletes(self, client, db, admin):
        r = _create_raffle(db)
        res = client.delete(f"/api/raffles/{r.id}", headers=auth_header(admin))
        assert res.status_code == 204
        assert db.query(Raffle).filter(Raffle.id == r.id).first() is None

    def test_volunteer_forbidden(self, client, db, volunteer):
        r = _create_raffle(db)
        res = client.delete(f"/api/raffles/{r.id}", headers=auth_header(volunteer))
        assert res.status_code == 403

    def test_delete_cascades_prizes(self, client, db, admin):
        r = _create_raffle(db)
        p = _add_prize(db, r)
        res = client.delete(f"/api/raffles/{r.id}", headers=auth_header(admin))
        assert res.status_code == 204
        assert db.query(RafflePrize).filter(RafflePrize.id == p.id).first() is None


# ---------------------------------------------------------------------------
# Prizes
# ---------------------------------------------------------------------------


class TestPrizes:
    def test_admin_adds_prize(self, client, db, admin):
        r = _create_raffle(db)
        res = client.post(
            f"/api/raffles/{r.id}/prizes",
            json={"title": "Bike", "description": "A nice bike", "position": 1},
            headers=auth_header(admin),
        )
        assert res.status_code == 201
        body = res.json()
        assert body["title"] == "Bike"
        assert body["position"] == 1
        assert body["winner_user_id"] is None

    def test_volunteer_cannot_add_prize(self, client, db, volunteer):
        r = _create_raffle(db)
        res = client.post(
            f"/api/raffles/{r.id}/prizes",
            json={"title": "X"},
            headers=auth_header(volunteer),
        )
        assert res.status_code == 403

    def test_admin_updates_prize(self, client, db, admin):
        r = _create_raffle(db)
        p = _add_prize(db, r)
        res = client.patch(
            f"/api/raffles/{r.id}/prizes/{p.id}",
            json={"title": "Renamed"},
            headers=auth_header(admin),
        )
        assert res.status_code == 200
        assert res.json()["title"] == "Renamed"

    def test_admin_deletes_prize(self, client, db, admin):
        r = _create_raffle(db)
        p = _add_prize(db, r)
        res = client.delete(f"/api/raffles/{r.id}/prizes/{p.id}", headers=auth_header(admin))
        assert res.status_code == 204
        assert db.query(RafflePrize).filter(RafflePrize.id == p.id).first() is None

    def test_cannot_add_prize_after_draw(self, client, db, admin):
        r = _create_raffle(db)
        r.drawn_at = datetime.utcnow()
        db.commit()
        res = client.post(
            f"/api/raffles/{r.id}/prizes",
            json={"title": "Late"},
            headers=auth_header(admin),
        )
        assert res.status_code == 400

    def test_prize_404_on_wrong_raffle(self, client, db, admin):
        r1 = _create_raffle(db, title="r1")
        r2 = _create_raffle(db, title="r2")
        p = _add_prize(db, r1)
        res = client.patch(
            f"/api/raffles/{r2.id}/prizes/{p.id}",
            json={"title": "x"},
            headers=auth_header(admin),
        )
        assert res.status_code == 404


# ---------------------------------------------------------------------------
# Prize images
# ---------------------------------------------------------------------------


class TestPrizeImages:
    def test_admin_uploads_image(self, client, db, admin, tmp_path):
        r = _create_raffle(db)
        p = _add_prize(db, r)
        with patch("app.routers.raffles.IMAGES_DIR_RAFFLES", str(tmp_path)):
            buf = _make_upload_image()
            res = client.post(
                f"/api/raffles/{r.id}/prizes/{p.id}/images",
                files={"file": ("photo.jpg", buf, "image/jpeg")},
                headers=auth_header(admin),
            )
        assert res.status_code == 201
        assert res.json()["url"].endswith(".jpg")

    def test_volunteer_cannot_upload(self, client, db, volunteer, tmp_path):
        r = _create_raffle(db)
        p = _add_prize(db, r)
        with patch("app.routers.raffles.IMAGES_DIR_RAFFLES", str(tmp_path)):
            buf = _make_upload_image()
            res = client.post(
                f"/api/raffles/{r.id}/prizes/{p.id}/images",
                files={"file": ("photo.jpg", buf, "image/jpeg")},
                headers=auth_header(volunteer),
            )
        assert res.status_code == 403

    def test_invalid_file_type(self, client, db, admin, tmp_path):
        r = _create_raffle(db)
        p = _add_prize(db, r)
        with patch("app.routers.raffles.IMAGES_DIR_RAFFLES", str(tmp_path)):
            res = client.post(
                f"/api/raffles/{r.id}/prizes/{p.id}/images",
                files={"file": ("doc.txt", BytesIO(b"hi"), "text/plain")},
                headers=auth_header(admin),
            )
        assert res.status_code == 400

    def test_admin_deletes_image(self, client, db, admin, tmp_path):
        r = _create_raffle(db)
        p = _add_prize(db, r)
        with patch("app.routers.raffles.IMAGES_DIR_RAFFLES", str(tmp_path)):
            buf = _make_upload_image()
            res = client.post(
                f"/api/raffles/{r.id}/prizes/{p.id}/images",
                files={"file": ("photo.jpg", buf, "image/jpeg")},
                headers=auth_header(admin),
            )
            image_id = res.json()["id"]
            res = client.delete(
                f"/api/raffles/{r.id}/prizes/{p.id}/images/{image_id}",
                headers=auth_header(admin),
            )
        assert res.status_code == 204
        assert (
            db.query(RafflePrizeImage).filter(RafflePrizeImage.id == uuid.UUID(image_id)).first()
            is None
        )


# ---------------------------------------------------------------------------
# Draw
# ---------------------------------------------------------------------------


class TestDraw:
    def test_draw_assigns_winners(self, client, db, admin):
        r = _create_raffle(db)
        p1 = _add_prize(db, r, title="A", position=1)
        p2 = _add_prize(db, r, title="B", position=2)
        # Eligible pool: 4 verified volunteers
        for i in range(4):
            _make_user(
                db,
                email=f"v{i}@example.com",
                user_type=UserType.volunteer,
                is_verified=True,
            )

        res = client.post(f"/api/raffles/{r.id}/draw", headers=auth_header(admin))
        assert res.status_code == 200
        body = res.json()
        assert body["drawn_at"] is not None
        winner_ids = [p["winner_user_id"] for p in body["prizes"]]
        assert all(w is not None for w in winner_ids)
        assert len(set(winner_ids)) == 2  # no duplicates

    def test_draw_excludes_admins(self, client, db, admin, superuser):
        r = _create_raffle(db)
        _add_prize(db, r)
        # Only one eligible volunteer
        v = _make_user(db, email="only@example.com", is_verified=True)
        res = client.post(f"/api/raffles/{r.id}/draw", headers=auth_header(admin))
        assert res.status_code == 200
        assert res.json()["prizes"][0]["winner_user_id"] == str(v.id)

    def test_draw_excludes_unverified(self, client, db, admin):
        r = _create_raffle(db)
        _add_prize(db, r)
        _make_user(db, email="unv@example.com", is_verified=False)
        res = client.post(f"/api/raffles/{r.id}/draw", headers=auth_header(admin))
        assert res.status_code == 400  # not enough eligible

    def test_draw_includes_moderators(self, client, db, admin):
        r = _create_raffle(db)
        _add_prize(db, r)
        m = _make_user(db, email="m@example.com", user_type=UserType.moderator, is_verified=True)
        res = client.post(f"/api/raffles/{r.id}/draw", headers=auth_header(admin))
        assert res.status_code == 200
        assert res.json()["prizes"][0]["winner_user_id"] == str(m.id)

    def test_draw_requires_prizes(self, client, db, admin, volunteer):
        r = _create_raffle(db)
        res = client.post(f"/api/raffles/{r.id}/draw", headers=auth_header(admin))
        assert res.status_code == 400

    def test_draw_not_enough_users(self, client, db, admin):
        r = _create_raffle(db)
        _add_prize(db, r, title="A")
        _add_prize(db, r, title="B")
        _make_user(db, email="solo@example.com", is_verified=True)
        res = client.post(f"/api/raffles/{r.id}/draw", headers=auth_header(admin))
        assert res.status_code == 400

    def test_draw_idempotent(self, client, db, admin, volunteer):
        r = _create_raffle(db)
        _add_prize(db, r)
        res = client.post(f"/api/raffles/{r.id}/draw", headers=auth_header(admin))
        assert res.status_code == 200
        res = client.post(f"/api/raffles/{r.id}/draw", headers=auth_header(admin))
        assert res.status_code == 400

    def test_volunteer_cannot_draw(self, client, db, volunteer):
        r = _create_raffle(db)
        _add_prize(db, r)
        res = client.post(f"/api/raffles/{r.id}/draw", headers=auth_header(volunteer))
        assert res.status_code == 403

    def test_winner_email_not_in_public_response(self, client, db, admin, volunteer):
        r = _create_raffle(db)
        _add_prize(db, r)
        client.post(f"/api/raffles/{r.id}/draw", headers=auth_header(admin))
        res = client.get(f"/api/raffles/{r.id}")
        assert res.status_code == 200
        winner = res.json()["prizes"][0]["winner"]
        assert winner is not None
        assert winner["full_name"] == volunteer.full_name
        assert "email" not in winner


# ---------------------------------------------------------------------------
# Admin winners listing + redraw
# ---------------------------------------------------------------------------


class TestWinnersAndRedraw:
    def test_admin_lists_winner_contacts(self, client, db, admin):
        r = _create_raffle(db)
        p1 = _add_prize(db, r, title="A", position=1)
        p2 = _add_prize(db, r, title="B", position=2)
        users = [
            _make_user(db, email=f"u{i}@example.com", full_name=f"User {i}", is_verified=True)
            for i in range(4)
        ]

        client.post(f"/api/raffles/{r.id}/draw", headers=auth_header(admin))
        res = client.get(f"/api/raffles/{r.id}/winners", headers=auth_header(admin))
        assert res.status_code == 200
        body = res.json()
        assert len(body) == 2
        emails = {row["email"] for row in body}
        assert emails <= {u.email for u in users}
        prize_ids = {row["prize_id"] for row in body}
        assert prize_ids == {str(p1.id), str(p2.id)}

    def test_winners_endpoint_admin_only(self, client, db, admin, volunteer):
        r = _create_raffle(db)
        _add_prize(db, r)
        client.post(f"/api/raffles/{r.id}/draw", headers=auth_header(admin))
        res = client.get(f"/api/raffles/{r.id}/winners", headers=auth_header(volunteer))
        assert res.status_code == 403
        res = client.get(f"/api/raffles/{r.id}/winners")
        assert res.status_code == 401

    def test_winners_endpoint_400_before_draw(self, client, db, admin):
        r = _create_raffle(db)
        _add_prize(db, r)
        res = client.get(f"/api/raffles/{r.id}/winners", headers=auth_header(admin))
        assert res.status_code == 400

    def test_redraw_picks_different_winner(self, client, db, admin):
        r = _create_raffle(db)
        p = _add_prize(db, r)
        for i in range(5):
            _make_user(db, email=f"v{i}@example.com", is_verified=True)

        client.post(f"/api/raffles/{r.id}/draw", headers=auth_header(admin))
        original = client.get(f"/api/raffles/{r.id}").json()["prizes"][0]["winner_user_id"]

        res = client.post(
            f"/api/raffles/{r.id}/prizes/{p.id}/redraw",
            headers=auth_header(admin),
        )
        assert res.status_code == 200
        new_winner = res.json()["winner_user_id"]
        assert new_winner is not None
        assert new_winner != original

    def test_redraw_excludes_other_prize_winners(self, client, db, admin):
        r = _create_raffle(db)
        p1 = _add_prize(db, r, title="A", position=1)
        _add_prize(db, r, title="B", position=2)
        # Exactly 2 eligible users: both will be drawn, leaving no candidates for a redraw.
        _make_user(db, email="a@example.com", is_verified=True)
        _make_user(db, email="b@example.com", is_verified=True)

        client.post(f"/api/raffles/{r.id}/draw", headers=auth_header(admin))
        res = client.post(
            f"/api/raffles/{r.id}/prizes/{p1.id}/redraw",
            headers=auth_header(admin),
        )
        assert res.status_code == 400

    def test_redraw_400_before_draw(self, client, db, admin, volunteer):
        r = _create_raffle(db)
        p = _add_prize(db, r)
        res = client.post(
            f"/api/raffles/{r.id}/prizes/{p.id}/redraw",
            headers=auth_header(admin),
        )
        assert res.status_code == 400

    def test_redraw_admin_only(self, client, db, admin, volunteer):
        r = _create_raffle(db)
        p = _add_prize(db, r)
        client.post(f"/api/raffles/{r.id}/draw", headers=auth_header(admin))
        res = client.post(
            f"/api/raffles/{r.id}/prizes/{p.id}/redraw",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 403

    def test_redraw_404_on_wrong_raffle(self, client, db, admin, volunteer):
        r1 = _create_raffle(db, title="r1")
        r2 = _create_raffle(db, title="r2")
        p = _add_prize(db, r1)
        client.post(f"/api/raffles/{r1.id}/draw", headers=auth_header(admin))
        res = client.post(
            f"/api/raffles/{r2.id}/prizes/{p.id}/redraw",
            headers=auth_header(admin),
        )
        assert res.status_code in (400, 404)
