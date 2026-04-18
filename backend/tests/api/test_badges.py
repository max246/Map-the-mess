"""Tests for badge awarding, persistence, and acknowledgement."""

from datetime import datetime, timedelta, timezone

from app.badges import evaluate_badges
from app.models.report import Report, ReportStatus
from app.models.user_badge import UserBadge

from tests.api.conftest import auth_header, _make_user

UK_LAT = 51.5
UK_LON = -0.1


def _make_report(
    db,
    *,
    created_by_user_id=None,
    resolved_by_user_id=None,
    status: ReportStatus = ReportStatus.pending,
    resolved_at=None,
):
    report = Report(
        latitude=UK_LAT,
        longitude=UK_LON,
        description="litter",
        created_by_user_id=created_by_user_id,
        resolved_by_user_id=resolved_by_user_id,
        status=status,
        resolved_at=resolved_at,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


class TestEvaluateBadgesPersistence:
    """evaluate_badges inserts UserBadge rows for newly-earned badges."""

    def test_user_with_no_activity_gets_no_badges(self, db, volunteer):
        badges = evaluate_badges(db, volunteer)
        assert badges == []
        assert db.query(UserBadge).filter(UserBadge.user_id == volunteer.id).count() == 0

    def test_first_report_awards_reporter_1(self, db, volunteer):
        _make_report(db, created_by_user_id=volunteer.id)

        badges = evaluate_badges(db, volunteer)

        assert len(badges) == 1
        assert badges[0].id == "reporter_1"
        # First legitimate earn → acknowledged_at is None so the banner fires
        assert badges[0].acknowledged_at is None
        assert badges[0].awarded_at is not None

    def test_first_cleanup_awards_resolver_1(self, db, volunteer):
        _make_report(
            db,
            resolved_by_user_id=volunteer.id,
            status=ReportStatus.cleaned,
            resolved_at=datetime.now(timezone.utc),
        )

        badges = evaluate_badges(db, volunteer)

        ids = {b.id for b in badges}
        assert "resolver_1" in ids
        assert next(b for b in badges if b.id == "resolver_1").acknowledged_at is None

    def test_repeated_calls_are_idempotent(self, db, volunteer):
        _make_report(db, created_by_user_id=volunteer.id)

        evaluate_badges(db, volunteer)
        evaluate_badges(db, volunteer)
        evaluate_badges(db, volunteer)

        rows = db.query(UserBadge).filter(UserBadge.user_id == volunteer.id).all()
        assert len(rows) == 1
        assert rows[0].badge_id == "reporter_1"

    def test_awarded_at_is_preserved_across_calls(self, db, volunteer):
        _make_report(db, created_by_user_id=volunteer.id)
        first = evaluate_badges(db, volunteer)
        first_awarded = first[0].awarded_at

        # Simulate more activity and re-run — reporter_1's awarded_at should
        # stay pinned to the original earn time, not be bumped.
        for _ in range(9):
            _make_report(db, created_by_user_id=volunteer.id)
        second = evaluate_badges(db, volunteer)

        reporter_1 = next(b for b in second if b.id == "reporter_1")
        assert reporter_1.awarded_at == first_awarded

    def test_crossing_next_threshold_awards_new_badge_only(self, db, volunteer):
        # Ten reports → both reporter_1 and reporter_10
        for _ in range(10):
            _make_report(db, created_by_user_id=volunteer.id)

        badges = evaluate_badges(db, volunteer)

        ids = {b.id for b in badges}
        assert ids == {"reporter_1", "reporter_10"}


class TestLegacyBackfillHeuristic:
    """When a user has no existing rows but qualifies for multiple badges at
    once, they predate the persistence feature — auto-acknowledge so the banner
    doesn't spam them with every historical earn."""

    def test_first_sync_with_many_badges_is_pre_acknowledged(self, db, volunteer):
        # 50 reports → reporter_1 + reporter_10 + reporter_50 all at once
        for _ in range(50):
            _make_report(db, created_by_user_id=volunteer.id)

        badges = evaluate_badges(db, volunteer)

        assert len(badges) == 3
        assert all(b.acknowledged_at is not None for b in badges)

    def test_first_sync_with_single_badge_stays_unacknowledged(self, db, volunteer):
        # Just one report — a genuinely new earn, not legacy data
        _make_report(db, created_by_user_id=volunteer.id)

        badges = evaluate_badges(db, volunteer)

        assert len(badges) == 1
        assert badges[0].acknowledged_at is None

    def test_subsequent_new_badges_are_not_auto_acked(self, db, volunteer):
        # First sync: legacy backfill — 10 reports earns reporter_1 + reporter_10
        for _ in range(10):
            _make_report(db, created_by_user_id=volunteer.id)
        evaluate_badges(db, volunteer)

        # Later: cross the reporter_50 threshold. This is a genuine new earn,
        # even though the user's first sync was backfilled.
        for _ in range(40):
            _make_report(db, created_by_user_id=volunteer.id)
        badges = evaluate_badges(db, volunteer)

        reporter_50 = next(b for b in badges if b.id == "reporter_50")
        assert reporter_50.acknowledged_at is None


class TestAcknowledgeEndpoint:
    """POST /api/badges/{badge_id}/acknowledge"""

    def test_acknowledge_earned_badge(self, client, db, volunteer):
        _make_report(db, created_by_user_id=volunteer.id)
        evaluate_badges(db, volunteer)

        res = client.post(
            "/api/badges/reporter_1/acknowledge",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 200
        assert res.json()["acknowledged_at"] is not None

        row = (
            db.query(UserBadge)
            .filter(UserBadge.user_id == volunteer.id, UserBadge.badge_id == "reporter_1")
            .first()
        )
        assert row.acknowledged_at is not None

    def test_acknowledge_is_idempotent(self, client, db, volunteer):
        _make_report(db, created_by_user_id=volunteer.id)
        evaluate_badges(db, volunteer)

        first = client.post(
            "/api/badges/reporter_1/acknowledge",
            headers=auth_header(volunteer),
        )
        first_ts = first.json()["acknowledged_at"]

        # Second call shouldn't move the timestamp
        second = client.post(
            "/api/badges/reporter_1/acknowledge",
            headers=auth_header(volunteer),
        )
        assert second.status_code == 200
        assert second.json()["acknowledged_at"] == first_ts

    def test_acknowledge_evaluates_on_the_fly_if_missing(self, client, db, volunteer):
        # User just earned reporter_1 but hasn't hit /me yet — acknowledge
        # should still work because it calls evaluate_badges first.
        _make_report(db, created_by_user_id=volunteer.id)

        res = client.post(
            "/api/badges/reporter_1/acknowledge",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 200

    def test_acknowledge_unknown_badge_id_returns_404(self, client, db, volunteer):
        res = client.post(
            "/api/badges/not_a_real_badge/acknowledge",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 404

    def test_acknowledge_unearned_badge_returns_404(self, client, db, volunteer):
        # Valid badge id, but user hasn't done anything to earn it
        res = client.post(
            "/api/badges/reporter_1/acknowledge",
            headers=auth_header(volunteer),
        )
        assert res.status_code == 404

    def test_acknowledge_requires_auth(self, client, db):
        res = client.post("/api/badges/reporter_1/acknowledge")
        assert res.status_code == 401

    def test_acknowledge_scoped_to_current_user(self, client, db):
        alice = _make_user(db, email="alice@example.com")
        bob = _make_user(db, email="bob@example.com")
        _make_report(db, created_by_user_id=alice.id)
        _make_report(db, created_by_user_id=bob.id)
        evaluate_badges(db, alice)
        evaluate_badges(db, bob)

        client.post(
            "/api/badges/reporter_1/acknowledge",
            headers=auth_header(alice),
        )

        alice_row = (
            db.query(UserBadge)
            .filter(UserBadge.user_id == alice.id, UserBadge.badge_id == "reporter_1")
            .first()
        )
        bob_row = (
            db.query(UserBadge)
            .filter(UserBadge.user_id == bob.id, UserBadge.badge_id == "reporter_1")
            .first()
        )
        assert alice_row.acknowledged_at is not None
        assert bob_row.acknowledged_at is None


class TestProfileReturnsBadgeTimestamps:
    """/api/auth/me and /api/volunteers/{id}/profile expose awarded_at and
    acknowledged_at so the frontend can highlight new badges."""

    def test_auth_me_includes_badge_timestamps(self, client, db, volunteer):
        _make_report(db, created_by_user_id=volunteer.id)

        res = client.get("/api/auth/me", headers=auth_header(volunteer))
        assert res.status_code == 200
        badges = res.json()["badges"]
        assert len(badges) == 1
        assert badges[0]["id"] == "reporter_1"
        assert "awarded_at" in badges[0]
        assert "acknowledged_at" in badges[0]
        assert badges[0]["acknowledged_at"] is None

    def test_public_profile_includes_badges(self, client, db, volunteer):
        _make_report(db, created_by_user_id=volunteer.id)
        evaluate_badges(db, volunteer)

        res = client.get(f"/api/volunteers/{volunteer.id}/profile")
        assert res.status_code == 200
        badges = res.json()["badges"]
        assert any(b["id"] == "reporter_1" for b in badges)
