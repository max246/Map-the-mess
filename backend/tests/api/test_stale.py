"""Tests for the stale-report scanner, the unstale endpoint, and the admin trigger."""

from datetime import datetime, timedelta

from app.models.report import Report, ReportStatus, ReportType
from app.models.report_status_log import ReportStatusAction, ReportStatusLog
from app.services.stale_reports import mark_stale_reports

from tests.api.conftest import auth_header, _make_user

UK_LAT = 51.5
UK_LON = -0.1


def _make_report(db, *, status=ReportStatus.pending, cycle: int = 0) -> Report:
    report = Report(
        latitude=UK_LAT,
        longitude=UK_LON,
        report_type=ReportType.litter,
        description="litter",
        status=status,
        current_cycle=cycle,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def _add_log(
    db, report: Report, action: ReportStatusAction, *, age_days: int = 0, cycle: int | None = None
) -> ReportStatusLog:
    entry = ReportStatusLog(
        report_id=report.id,
        action=action,
        cycle=cycle if cycle is not None else report.current_cycle,
        created_at=datetime.utcnow() - timedelta(days=age_days),
    )
    db.add(entry)
    db.commit()
    db.refresh(report)
    return entry


class TestMarkStaleService:
    def test_marks_old_pending_report(self, db):
        report = _make_report(db)
        _add_log(db, report, ReportStatusAction.created, age_days=45)
        assert mark_stale_reports(db, threshold_days=30) == 1
        db.refresh(report)
        assert report.is_stale is True
        actions = [e.action for e in report.status_log]
        assert actions[-1] == ReportStatusAction.stale

    def test_skips_fresh_pending_report(self, db):
        report = _make_report(db)
        _add_log(db, report, ReportStatusAction.created, age_days=5)
        assert mark_stale_reports(db, threshold_days=30) == 0
        db.refresh(report)
        assert report.is_stale is False

    def test_skips_cleaned_report(self, db):
        report = _make_report(db, status=ReportStatus.cleaned)
        _add_log(db, report, ReportStatusAction.cleaned, age_days=60)
        assert mark_stale_reports(db, threshold_days=30) == 0
        db.refresh(report)
        assert report.is_stale is False

    def test_is_idempotent(self, db):
        report = _make_report(db)
        _add_log(db, report, ReportStatusAction.created, age_days=45)
        mark_stale_reports(db, threshold_days=30)
        assert mark_stale_reports(db, threshold_days=30) == 0

    def test_unstale_resets_clock(self, db):
        report = _make_report(db)
        _add_log(db, report, ReportStatusAction.created, age_days=45)
        _add_log(db, report, ReportStatusAction.stale, age_days=10)
        _add_log(db, report, ReportStatusAction.unstale, age_days=1)
        # The unstale 1 day ago is well inside the 30-day window — no re-stale
        assert mark_stale_reports(db, threshold_days=30) == 0
        db.refresh(report)
        assert report.is_stale is False

    def test_unstale_followed_by_long_inactivity_re_stales(self, db):
        report = _make_report(db)
        _add_log(db, report, ReportStatusAction.created, age_days=80)
        _add_log(db, report, ReportStatusAction.stale, age_days=50)
        _add_log(db, report, ReportStatusAction.unstale, age_days=45)
        assert mark_stale_reports(db, threshold_days=30) == 1
        db.refresh(report)
        assert report.is_stale is True

    def test_only_current_cycle_counts(self, db):
        # An old `cleaned` log from cycle 0 shouldn't be the reference point —
        # the report was reopened, so cycle 1 is what matters.
        report = _make_report(db, cycle=1)
        _add_log(db, report, ReportStatusAction.created, age_days=90, cycle=0)
        _add_log(db, report, ReportStatusAction.cleaned, age_days=80, cycle=0)
        _add_log(db, report, ReportStatusAction.reopened, age_days=5, cycle=1)
        assert mark_stale_reports(db, threshold_days=30) == 0
        db.refresh(report)
        assert report.is_stale is False


class TestUnstaleEndpoint:
    def test_requires_auth(self, client, db):
        report = _make_report(db)
        _add_log(db, report, ReportStatusAction.created, age_days=45)
        mark_stale_reports(db, threshold_days=30)
        res = client.post(f"/api/reports/{report.id}/unstale")
        assert res.status_code == 401

    def test_clears_stale_for_authed_user(self, client, db, volunteer):
        report = _make_report(db)
        _add_log(db, report, ReportStatusAction.created, age_days=45)
        mark_stale_reports(db, threshold_days=30)
        res = client.post(f"/api/reports/{report.id}/unstale", headers=auth_header(volunteer))
        assert res.status_code == 200
        assert res.json()["is_stale"] is False
        db.refresh(report)
        assert report.status_log[-1].action == ReportStatusAction.unstale
        assert report.status_log[-1].performed_by_user_id == volunteer.id

    def test_400_when_not_stale(self, client, db, volunteer):
        report = _make_report(db)
        _add_log(db, report, ReportStatusAction.created, age_days=5)
        res = client.post(f"/api/reports/{report.id}/unstale", headers=auth_header(volunteer))
        assert res.status_code == 400

    def test_404_when_missing(self, client, db, volunteer):
        res = client.post(
            "/api/reports/00000000-0000-0000-0000-000000009999/unstale",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 404


class TestAdminMarkStaleEndpoint:
    def test_requires_secret(self, client, db, monkeypatch):
        monkeypatch.setattr("app.routers.admin.ADMIN_TASK_SECRET", "expected")
        res = client.post("/api/admin/tasks/mark-stale")
        assert res.status_code == 401

    def test_rejects_wrong_secret(self, client, db, monkeypatch):
        monkeypatch.setattr("app.routers.admin.ADMIN_TASK_SECRET", "expected")
        res = client.post("/api/admin/tasks/mark-stale", headers={"X-Task-Secret": "wrong"})
        assert res.status_code == 401

    def test_rejects_when_unconfigured(self, client, db, monkeypatch):
        # Empty secret means the endpoint refuses any caller.
        monkeypatch.setattr("app.routers.admin.ADMIN_TASK_SECRET", "")
        res = client.post("/api/admin/tasks/mark-stale", headers={"X-Task-Secret": "anything"})
        assert res.status_code == 401

    def test_runs_with_correct_secret(self, client, db, monkeypatch):
        monkeypatch.setattr("app.routers.admin.ADMIN_TASK_SECRET", "expected")
        # Default REPORT_STALE_DAYS is 30; create one ancient pending report
        report = _make_report(db)
        _add_log(db, report, ReportStatusAction.created, age_days=120)
        res = client.post("/api/admin/tasks/mark-stale", headers={"X-Task-Secret": "expected"})
        assert res.status_code == 200
        assert res.json() == {"marked": 1}
        db.refresh(report)
        assert report.is_stale is True


class TestIsStaleInResponses:
    def test_get_report_includes_is_stale(self, client, db):
        report = _make_report(db)
        _add_log(db, report, ReportStatusAction.created, age_days=45)
        mark_stale_reports(db, threshold_days=30)
        res = client.get(f"/api/reports/{report.id}")
        assert res.status_code == 200
        assert res.json()["is_stale"] is True

    def test_list_filter_is_stale_true(self, client, db):
        stale_report = _make_report(db)
        _add_log(db, stale_report, ReportStatusAction.created, age_days=45)
        fresh_report = _make_report(db)
        _add_log(db, fresh_report, ReportStatusAction.created, age_days=5)
        mark_stale_reports(db, threshold_days=30)
        res = client.get("/api/reports/?is_stale=true")
        assert res.status_code == 200
        ids = [r["id"] for r in res.json()]
        assert str(stale_report.id) in ids
        assert str(fresh_report.id) not in ids

    def test_list_filter_is_stale_false(self, client, db):
        stale_report = _make_report(db)
        _add_log(db, stale_report, ReportStatusAction.created, age_days=45)
        fresh_report = _make_report(db)
        _add_log(db, fresh_report, ReportStatusAction.created, age_days=5)
        mark_stale_reports(db, threshold_days=30)
        res = client.get("/api/reports/?is_stale=false")
        assert res.status_code == 200
        ids = [r["id"] for r in res.json()]
        assert str(fresh_report.id) in ids
        assert str(stale_report.id) not in ids
