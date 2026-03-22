"""Tests for report endpoints (/api/reports)."""

import io

from app.models.report import Report, ReportStatus
from app.models.report_image import ReportImage, ImageType

from tests.api.conftest import auth_header, _make_user

# Valid UK coordinates for test reports
UK_LAT = 51.5
UK_LON = -0.1


def _create_report(db, **overrides) -> Report:
    """Insert a report directly into the DB."""
    defaults = dict(latitude=UK_LAT, longitude=UK_LON, description="litter")
    defaults.update(overrides)
    report = Report(**defaults)
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def _make_image_buf() -> io.BytesIO:
    """Return a minimal valid JPEG as a BytesIO."""
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (10, 10), "red").save(buf, format="JPEG")
    buf.seek(0)
    return buf


class TestListReports:
    def test_empty_list(self, client, db):
        res = client.get("/api/reports/")
        assert res.status_code == 200
        assert res.json() == []

    def test_list_returns_reports(self, client, db):
        _create_report(db)
        _create_report(db, description="second")
        res = client.get("/api/reports/")
        assert res.status_code == 200
        assert len(res.json()) == 2

    def test_filter_by_status(self, client, db):
        _create_report(db, status=ReportStatus.pending)
        _create_report(db, status=ReportStatus.cleaned)
        res = client.get("/api/reports/?status=pending")
        assert len(res.json()) == 1
        assert res.json()[0]["status"] == "pending"


class TestGetReport:
    def test_get_existing(self, client, db):
        report = _create_report(db)
        res = client.get(f"/api/reports/{report.id}")
        assert res.status_code == 200
        assert res.json()["id"] == report.id

    def test_get_nonexistent(self, client, db):
        res = client.get("/api/reports/9999")
        assert res.status_code == 404


class TestCreateReport:
    def test_create_without_auth(self, client, db):
        res = client.post(
            "/api/reports/",
            data={"latitude": UK_LAT, "longitude": UK_LON, "description": "mess"},
        )
        assert res.status_code == 201
        data = res.json()
        assert data["latitude"] == UK_LAT
        assert data["status"] == "pending"
        assert data["created_by_user_id"] is None

    def test_create_with_auth(self, client, db, volunteer):
        res = client.post(
            "/api/reports/",
            data={"latitude": UK_LAT, "longitude": UK_LON, "description": "mess"},
            headers=auth_header(volunteer),
        )
        assert res.status_code == 201
        assert res.json()["created_by_user_id"] == volunteer.id

    def test_create_with_image(self, client, db):
        res = client.post(
            "/api/reports/",
            data={"latitude": UK_LAT, "longitude": UK_LON, "description": "with img"},
            files={"image": ("test.jpg", _make_image_buf(), "image/jpeg")},
        )
        assert res.status_code == 201
        assert len(res.json()["images"]) == 1

    def test_create_outside_uk(self, client, db):
        res = client.post(
            "/api/reports/",
            data={"latitude": 40.0, "longitude": -74.0, "description": "NYC"},
        )
        assert res.status_code == 400
        assert "UK" in res.json()["detail"]

    def test_create_with_what3words(self, client, db):
        res = client.post(
            "/api/reports/",
            data={
                "latitude": UK_LAT,
                "longitude": UK_LON,
                "description": "w3w",
                "what3words": "filled.count.soap",
            },
        )
        assert res.status_code == 201
        assert res.json()["what3words"] == "filled.count.soap"


class TestMarkCleaned:
    def test_mark_cleaned(self, client, db):
        report = _create_report(db)
        res = client.patch(f"/api/reports/{report.id}/clean")
        assert res.status_code == 200
        assert res.json()["status"] == "cleaned"
        assert res.json()["resolved_at"] is not None

    def test_mark_cleaned_with_auth(self, client, db, volunteer):
        report = _create_report(db)
        res = client.patch(
            f"/api/reports/{report.id}/clean",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 200
        assert res.json()["resolved_by_user_id"] == volunteer.id

    def test_mark_cleaned_nonexistent(self, client, db):
        res = client.patch("/api/reports/9999/clean")
        assert res.status_code == 404


class TestUnresolve:
    def test_moderator_can_unresolve(self, client, db, moderator):
        report = _create_report(db, status=ReportStatus.cleaned)
        res = client.patch(
            f"/api/reports/{report.id}/unresolve",
            headers=auth_header(moderator),
        )
        assert res.status_code == 200
        assert res.json()["status"] == "pending"
        assert res.json()["resolved_at"] is None

    def test_volunteer_cannot_unresolve(self, client, db, volunteer):
        report = _create_report(db, status=ReportStatus.cleaned)
        res = client.patch(
            f"/api/reports/{report.id}/unresolve",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 403

    def test_unauthenticated_cannot_unresolve(self, client, db):
        report = _create_report(db, status=ReportStatus.cleaned)
        res = client.patch(f"/api/reports/{report.id}/unresolve")
        assert res.status_code == 401


class TestDeleteReport:
    def test_moderator_can_delete(self, client, db, moderator):
        report = _create_report(db)
        res = client.delete(
            f"/api/reports/{report.id}",
            headers=auth_header(moderator),
        )
        assert res.status_code == 204

    def test_volunteer_cannot_delete(self, client, db, volunteer):
        report = _create_report(db)
        res = client.delete(
            f"/api/reports/{report.id}",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 403

    def test_delete_nonexistent(self, client, db, moderator):
        res = client.delete(
            "/api/reports/9999",
            headers=auth_header(moderator),
        )
        assert res.status_code == 404


class TestAddImage:
    def test_add_image_to_report(self, client, db):
        report = _create_report(db)
        res = client.post(
            f"/api/reports/{report.id}/images",
            data={"image_type": "report"},
            files=[("file", ("photo.jpg", _make_image_buf(), "image/jpeg"))],
        )
        assert res.status_code == 201
        assert res.json()["image_type"] == "report"

    def test_add_image_to_nonexistent_report(self, client, db):
        res = client.post(
            "/api/reports/9999/images",
            data={"image_type": "report"},
            files=[("file", ("photo.jpg", _make_image_buf(), "image/jpeg"))],
        )
        assert res.status_code == 404

    def test_add_image_invalid_type(self, client, db):
        report = _create_report(db)
        res = client.post(
            f"/api/reports/{report.id}/images",
            data={"image_type": "invalid"},
            files=[("file", ("photo.jpg", _make_image_buf(), "image/jpeg"))],
        )
        assert res.status_code == 400


class TestDeleteImage:
    def test_moderator_can_delete_image(self, client, db, moderator):
        report = _create_report(db)
        img = ReportImage(
            report_id=report.id,
            url="fake.jpg",
            thumbnail_url="fake_thumb.jpg",
            image_type=ImageType.report,
        )
        db.add(img)
        db.commit()
        db.refresh(img)

        res = client.delete(
            f"/api/reports/images/{img.id}",
            headers=auth_header(moderator),
        )
        assert res.status_code == 204

    def test_volunteer_cannot_delete_image(self, client, db, volunteer):
        report = _create_report(db)
        img = ReportImage(
            report_id=report.id,
            url="fake.jpg",
            thumbnail_url="fake_thumb.jpg",
            image_type=ImageType.report,
        )
        db.add(img)
        db.commit()
        db.refresh(img)

        res = client.delete(
            f"/api/reports/images/{img.id}",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 403

    def test_delete_nonexistent_image(self, client, db, moderator):
        res = client.delete(
            "/api/reports/images/9999",
            headers=auth_header(moderator),
        )
        assert res.status_code == 404
