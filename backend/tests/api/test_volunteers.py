"""Tests for volunteer endpoints (/api/volunteers)."""

from app.models.favourite import Favourite
from app.models.report import Report, ReportStatus

from tests.api.conftest import auth_header, _make_user

UK_LAT = 51.5
UK_LON = -0.1


def _create_report(db, **overrides) -> Report:
    defaults = dict(latitude=UK_LAT, longitude=UK_LON, description="litter")
    defaults.update(overrides)
    report = Report(**defaults)
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


class TestVolunteerCount:
    def test_count_no_users(self, client, db):
        res = client.get("/api/volunteers/count")
        assert res.status_code == 200
        assert res.json()["count"] == 0

    def test_count_with_users(self, client, db, volunteer, admin):
        res = client.get("/api/volunteers/count")
        assert res.status_code == 200
        assert res.json()["count"] == 2


class TestAddFavourite:
    def test_add_favourite(self, client, db, volunteer):
        report = _create_report(db)
        res = client.post(
            f"/api/volunteers/favourites/{report.id}",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 201

    def test_add_duplicate_favourite(self, client, db, volunteer):
        report = _create_report(db)
        client.post(
            f"/api/volunteers/favourites/{report.id}",
            headers=auth_header(volunteer),
        )
        res = client.post(
            f"/api/volunteers/favourites/{report.id}",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 409

    def test_add_favourite_nonexistent_report(self, client, db, volunteer):
        res = client.post(
            "/api/volunteers/favourites/9999",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 404

    def test_add_favourite_unauthenticated(self, client, db):
        report = _create_report(db)
        res = client.post(f"/api/volunteers/favourites/{report.id}")
        assert res.status_code == 401


class TestListFavourites:
    def test_list_favourites(self, client, db, volunteer):
        r1 = _create_report(db, description="one")
        r2 = _create_report(db, description="two")
        db.add(Favourite(user_id=volunteer.id, report_id=r1.id))
        db.add(Favourite(user_id=volunteer.id, report_id=r2.id))
        db.commit()

        res = client.get(
            "/api/volunteers/favourites",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 200
        assert len(res.json()) == 2

    def test_list_favourites_filter_by_status(self, client, db, volunteer):
        pending = _create_report(db, status=ReportStatus.pending)
        cleaned = _create_report(db, status=ReportStatus.cleaned)
        db.add(Favourite(user_id=volunteer.id, report_id=pending.id))
        db.add(Favourite(user_id=volunteer.id, report_id=cleaned.id))
        db.commit()

        res = client.get(
            "/api/volunteers/favourites?status=pending",
            headers=auth_header(volunteer),
        )
        assert len(res.json()) == 1
        assert res.json()[0]["status"] == "pending"

    def test_list_favourites_empty(self, client, db, volunteer):
        res = client.get(
            "/api/volunteers/favourites",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 200
        assert res.json() == []

    def test_list_favourites_unauthenticated(self, client, db):
        res = client.get("/api/volunteers/favourites")
        assert res.status_code == 401


class TestRemoveFavourite:
    def test_remove_favourite(self, client, db, volunteer):
        report = _create_report(db)
        db.add(Favourite(user_id=volunteer.id, report_id=report.id))
        db.commit()

        res = client.delete(
            f"/api/volunteers/favourites/{report.id}",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 204

    def test_remove_nonexistent_favourite(self, client, db, volunteer):
        report = _create_report(db)
        res = client.delete(
            f"/api/volunteers/favourites/{report.id}",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 404

    def test_remove_favourite_unauthenticated(self, client, db):
        report = _create_report(db)
        res = client.delete(f"/api/volunteers/favourites/{report.id}")
        assert res.status_code == 401
