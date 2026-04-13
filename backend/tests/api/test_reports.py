"""Tests for report endpoints (/api/reports)."""

import io

from app.models.report import Report, ReportStatus, ReportType
from app.models.report_image import ReportImage, ImageType

from tests.api.conftest import auth_header, _make_user

# Valid UK coordinates for test reports
UK_LAT = 51.5
UK_LON = -0.1


def _create_report(db, **overrides) -> Report:
    """Insert a report directly into the DB."""
    defaults = dict(
        latitude=UK_LAT, longitude=UK_LON, report_type=ReportType.litter, description="litter"
    )
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


class TestExportReports:
    def test_export_requires_auth(self, client, db):
        res = client.get("/api/reports/export")
        assert res.status_code == 401

    def test_export_empty(self, client, db):
        user = _make_user(db)
        res = client.get("/api/reports/export", headers=auth_header(user))
        assert res.status_code == 200
        assert res.json() == []
        assert "attachment" in res.headers.get("content-disposition", "")

    def test_export_returns_all_reports(self, client, db):
        _create_report(db, description="first")
        _create_report(db, description="second", status=ReportStatus.cleaned)
        user = _make_user(db)
        res = client.get("/api/reports/export", headers=auth_header(user))
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 2
        assert set(r["description"] for r in data) == {"first", "second"}

    def test_export_excludes_images(self, client, db):
        _create_report(db)
        user = _make_user(db)
        res = client.get("/api/reports/export", headers=auth_header(user))
        data = res.json()
        assert "images" not in data[0]

    def test_export_fields(self, client, db):
        _create_report(db, description="test", address="123 Street")
        user = _make_user(db)
        res = client.get("/api/reports/export", headers=auth_header(user))
        report = res.json()[0]
        expected_keys = {
            "id",
            "latitude",
            "longitude",
            "report_type",
            "description",
            "what3words",
            "address",
            "status",
            "created_at",
            "resolved_at",
        }
        assert set(report.keys()) == expected_keys


class TestGetReport:
    def test_get_existing(self, client, db):
        report = _create_report(db)
        res = client.get(f"/api/reports/{report.id}")
        assert res.status_code == 200
        assert res.json()["id"] == str(report.id)

    def test_get_nonexistent(self, client, db):
        res = client.get("/api/reports/00000000-0000-0000-0000-000000009999")
        assert res.status_code == 404


class TestCreateReport:
    def test_create_without_auth(self, client, db):
        res = client.post(
            "/api/reports/",
            data={
                "latitude": UK_LAT,
                "longitude": UK_LON,
                "report_type": "litter",
                "description": "mess",
            },
        )
        assert res.status_code == 201
        data = res.json()
        assert data["latitude"] == UK_LAT
        assert data["status"] == "pending"
        assert data["created_by_user_id"] is None

    def test_create_with_auth(self, client, db, volunteer):
        res = client.post(
            "/api/reports/",
            data={
                "latitude": UK_LAT,
                "longitude": UK_LON,
                "report_type": "litter",
                "description": "mess",
            },
            headers=auth_header(volunteer),
        )
        assert res.status_code == 201
        assert res.json()["created_by_user_id"] == str(volunteer.id)

    def test_create_with_image(self, client, db):
        res = client.post(
            "/api/reports/",
            data={
                "latitude": UK_LAT,
                "longitude": UK_LON,
                "report_type": "litter",
                "description": "with img",
            },
            files={"image": ("test.jpg", _make_image_buf(), "image/jpeg")},
        )
        assert res.status_code == 201
        assert len(res.json()["images"]) == 1

    def test_create_outside_uk(self, client, db):
        res = client.post(
            "/api/reports/",
            data={
                "latitude": 40.0,
                "longitude": -74.0,
                "report_type": "litter",
                "description": "NYC",
            },
        )
        assert res.status_code == 400
        assert "UK" in res.json()["detail"]

    def test_create_with_what3words(self, client, db):
        res = client.post(
            "/api/reports/",
            data={
                "latitude": UK_LAT,
                "longitude": UK_LON,
                "report_type": "litter",
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
        assert res.json()["resolved_by_user_id"] == str(volunteer.id)

    def test_mark_cleaned_nonexistent(self, client, db):
        res = client.patch("/api/reports/00000000-0000-0000-0000-000000009999/clean")
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

    def test_volunteer_can_unresolve(self, client, db, volunteer):
        report = _create_report(db, status=ReportStatus.cleaned)
        res = client.patch(
            f"/api/reports/{report.id}/unresolve",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 200
        assert res.json()["status"] == "pending"

    def test_unauthenticated_can_unresolve(self, client, db):
        report = _create_report(db, status=ReportStatus.cleaned)
        res = client.patch(f"/api/reports/{report.id}/unresolve")
        assert res.status_code == 200
        assert res.json()["status"] == "pending"

    def test_unresolve_with_image(self, client, db, volunteer):
        report = _create_report(db, status=ReportStatus.cleaned)
        res = client.patch(
            f"/api/reports/{report.id}/unresolve",
            files=[("image", ("proof.jpg", _make_image_buf(), "image/jpeg"))],
            headers=auth_header(volunteer),
        )
        assert res.status_code == 200
        assert res.json()["status"] == "pending"
        images = [
            img for img in res.json()["images"] if img["cycle"] == res.json()["current_cycle"]
        ]
        assert len(images) == 1
        assert images[0]["image_type"] == "report"

    def test_unresolve_nonexistent(self, client, db):
        res = client.patch("/api/reports/00000000-0000-0000-0000-000000009999/unresolve")
        assert res.status_code == 404


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
            "/api/reports/00000000-0000-0000-0000-000000009999",
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
            "/api/reports/00000000-0000-0000-0000-000000009999/images",
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
            "/api/reports/images/00000000-0000-0000-0000-000000009999",
            headers=auth_header(moderator),
        )
        assert res.status_code == 404


class TestUpdateReport:
    def test_moderator_can_edit_description(self, client, db, moderator):
        report = _create_report(db)
        res = client.patch(
            f"/api/reports/{report.id}",
            json={"description": "updated text"},
            headers=auth_header(moderator),
        )
        assert res.status_code == 200
        assert res.json()["description"] == "updated text"

    def test_admin_can_edit_report_type(self, client, db, admin):
        report = _create_report(db)
        res = client.patch(
            f"/api/reports/{report.id}",
            json={"report_type": "gas_canister"},
            headers=auth_header(admin),
        )
        assert res.status_code == 200
        assert res.json()["report_type"] == "gas_canister"

    def test_moderator_can_remove_images(self, client, db, moderator):
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

        res = client.patch(
            f"/api/reports/{report.id}",
            json={"remove_image_ids": [str(img.id)]},
            headers=auth_header(moderator),
        )
        assert res.status_code == 200
        assert len(res.json()["images"]) == 0

    def test_volunteer_cannot_edit(self, client, db, volunteer):
        report = _create_report(db)
        res = client.patch(
            f"/api/reports/{report.id}",
            json={"description": "nope"},
            headers=auth_header(volunteer),
        )
        assert res.status_code == 403

    def test_unauthenticated_cannot_edit(self, client, db):
        report = _create_report(db)
        res = client.patch(
            f"/api/reports/{report.id}",
            json={"description": "nope"},
        )
        assert res.status_code == 401

    def test_edit_nonexistent_report(self, client, db, moderator):
        res = client.patch(
            "/api/reports/00000000-0000-0000-0000-000000009999",
            json={"description": "nope"},
            headers=auth_header(moderator),
        )
        assert res.status_code == 404

    def test_invalid_report_type(self, client, db, moderator):
        report = _create_report(db)
        res = client.patch(
            f"/api/reports/{report.id}",
            json={"report_type": "invalid_type"},
            headers=auth_header(moderator),
        )
        assert res.status_code == 400


# ---------------------------------------------------------------------------
# Status log
# ---------------------------------------------------------------------------


class TestStatusLog:
    """Tests for the report status history log."""

    def _create_via_api(self, client, headers=None):
        """Create a report via the API so it gets a log entry."""
        return client.post(
            "/api/reports/",
            data={
                "latitude": UK_LAT,
                "longitude": UK_LON,
                "report_type": "litter",
                "description": "test",
            },
            headers=headers,
        )

    def test_create_report_logs_created(self, client, db):
        res = self._create_via_api(client)
        assert res.status_code == 201
        data = res.json()
        assert len(data["status_log"]) == 1
        assert data["status_log"][0]["action"] == "created"
        assert data["status_log"][0]["cycle"] == 0
        assert data["status_log"][0]["performed_by_user_id"] is None

    def test_create_report_with_auth_logs_user(self, client, db, volunteer):
        res = self._create_via_api(client, headers=auth_header(volunteer))
        assert res.status_code == 201
        log = res.json()["status_log"]
        assert len(log) == 1
        assert log[0]["performed_by_user_id"] == str(volunteer.id)

    def test_mark_cleaned_logs_cleaned(self, client, db, volunteer):
        create_res = self._create_via_api(client, headers=auth_header(volunteer))
        report_id = create_res.json()["id"]

        res = client.patch(
            f"/api/reports/{report_id}/clean",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 200
        log = res.json()["status_log"]
        assert len(log) == 2
        assert log[0]["action"] == "created"
        assert log[1]["action"] == "cleaned"
        assert log[1]["cycle"] == 0

    def test_unresolve_logs_reopened(self, client, db, volunteer, moderator):
        create_res = self._create_via_api(client, headers=auth_header(volunteer))
        report_id = create_res.json()["id"]

        client.patch(
            f"/api/reports/{report_id}/clean",
            headers=auth_header(volunteer),
        )
        res = client.patch(
            f"/api/reports/{report_id}/unresolve",
            headers=auth_header(moderator),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["current_cycle"] == 1
        log = data["status_log"]
        assert len(log) == 3
        assert log[0]["action"] == "created"
        assert log[1]["action"] == "cleaned"
        assert log[2]["action"] == "reopened"
        assert log[2]["cycle"] == 1
        assert log[2]["performed_by_user_id"] == str(moderator.id)

    def test_full_cycle(self, client, db, volunteer, moderator):
        """create → clean → reopen → clean = 4 log entries."""
        create_res = self._create_via_api(client, headers=auth_header(volunteer))
        report_id = create_res.json()["id"]

        client.patch(f"/api/reports/{report_id}/clean", headers=auth_header(volunteer))
        client.patch(f"/api/reports/{report_id}/unresolve", headers=auth_header(moderator))
        res = client.patch(f"/api/reports/{report_id}/clean", headers=auth_header(volunteer))

        assert res.status_code == 200
        data = res.json()
        assert data["current_cycle"] == 1
        log = data["status_log"]
        assert len(log) == 4
        actions = [e["action"] for e in log]
        assert actions == ["created", "cleaned", "reopened", "cleaned"]
        assert log[2]["cycle"] == 1
        assert log[3]["cycle"] == 1

    def test_images_stamped_with_cycle(self, client, db, volunteer, moderator):
        """Images uploaded after a reopen get the new cycle number."""
        create_res = self._create_via_api(client, headers=auth_header(volunteer))
        report_id = create_res.json()["id"]

        # Upload image in cycle 0
        client.post(
            f"/api/reports/{report_id}/images",
            data={"image_type": "report"},
            files=[("file", ("c0.jpg", _make_image_buf(), "image/jpeg"))],
        )

        # Clean and reopen
        client.patch(f"/api/reports/{report_id}/clean", headers=auth_header(volunteer))
        client.patch(f"/api/reports/{report_id}/unresolve", headers=auth_header(moderator))

        # Upload image in cycle 1
        client.post(
            f"/api/reports/{report_id}/images",
            data={"image_type": "report"},
            files=[("file", ("c1.jpg", _make_image_buf(), "image/jpeg"))],
        )

        res = client.get(f"/api/reports/{report_id}")
        images = res.json()["images"]
        assert len(images) == 2
        cycles = sorted(img["cycle"] for img in images)
        assert cycles == [0, 1]

    def test_reopen_increments_current_cycle(self, client, db, volunteer, moderator):
        """Reopening twice yields current_cycle=2."""
        create_res = self._create_via_api(client, headers=auth_header(volunteer))
        report_id = create_res.json()["id"]

        client.patch(f"/api/reports/{report_id}/clean", headers=auth_header(volunteer))
        client.patch(f"/api/reports/{report_id}/unresolve", headers=auth_header(moderator))
        client.patch(f"/api/reports/{report_id}/clean", headers=auth_header(volunteer))
        res = client.patch(f"/api/reports/{report_id}/unresolve", headers=auth_header(moderator))

        assert res.status_code == 200
        assert res.json()["current_cycle"] == 2

    def test_status_log_ordered_chronologically(self, client, db, volunteer, moderator):
        create_res = self._create_via_api(client, headers=auth_header(volunteer))
        report_id = create_res.json()["id"]

        client.patch(f"/api/reports/{report_id}/clean", headers=auth_header(volunteer))
        res = client.patch(f"/api/reports/{report_id}/unresolve", headers=auth_header(moderator))

        log = res.json()["status_log"]
        timestamps = [e["created_at"] for e in log]
        assert timestamps == sorted(timestamps)
