"""Badge definitions and evaluation logic."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.report import Report, ReportStatus
from app.models.user import User
from app.models.user_badge import UserBadge
from app.schemas.user import BadgeRead


@dataclass(frozen=True)
class BadgeDef:
    id: str
    name: str
    description: str


# ── Reporting badges (number of reports created) ─────────────────────
REPORTING_BADGES: list[tuple[int, BadgeDef]] = [
    (1, BadgeDef("reporter_1", "First Spotter", "Reported your first litter")),
    (10, BadgeDef("reporter_10", "Sharp Eye", "Reported 10 litter spots")),
    (50, BadgeDef("reporter_50", "Litter Hawk", "Reported 50 litter spots")),
    (100, BadgeDef("reporter_100", "Eagle Eye", "Reported 100 litter spots")),
    (500, BadgeDef("reporter_500", "Litter Radar", "Reported 500 litter spots")),
]

# ── Resolving badges (number of reports cleaned) ────────────────────
RESOLVING_BADGES: list[tuple[int, BadgeDef]] = [
    (1, BadgeDef("resolver_1", "First Cleanup", "Cleaned your first report")),
    (10, BadgeDef("resolver_10", "Street Sweeper", "Cleaned 10 reports")),
    (50, BadgeDef("resolver_50", "Cleanup Crew", "Cleaned 50 reports")),
    (100, BadgeDef("resolver_100", "Eco Warrior", "Cleaned 100 reports")),
    (500, BadgeDef("resolver_500", "Planet Guardian", "Cleaned 500 reports")),
]

# ── Loyalty badges (active for N years) ──────────────────────────────
LOYALTY_BADGES: list[tuple[int, BadgeDef]] = [
    (1, BadgeDef("year_1", "1 Year", "Active member for 1 year")),
    (2, BadgeDef("year_2", "2 Years", "Active member for 2 years")),
    (3, BadgeDef("year_3", "3 Years", "Active member for 3 years")),
    (5, BadgeDef("year_5", "5 Years", "Active member for 5 years")),
    (10, BadgeDef("year_10", "Decade", "Active member for 10 years")),
]


_ALL_BADGES: dict[str, BadgeDef] = {
    b.id: b for _, b in REPORTING_BADGES + RESOLVING_BADGES + LOYALTY_BADGES
}


def _years_since_signup(user: User) -> int:
    """Return the number of full years since the user signed up."""
    now = datetime.now(timezone.utc)
    created = user.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    delta = now - created
    return delta.days // 365


def _had_activity_in_year(db: Session, user_id, year_start: datetime, year_end: datetime) -> bool:
    """Check if the user reported or resolved anything in a given year window."""
    reported = (
        db.query(Report.id)
        .filter(
            Report.created_by_user_id == user_id,
            Report.created_at >= year_start,
            Report.created_at < year_end,
        )
        .first()
    )
    if reported:
        return True

    resolved = (
        db.query(Report.id)
        .filter(
            Report.resolved_by_user_id == user_id,
            Report.status == ReportStatus.cleaned,
            Report.resolved_at >= year_start,
            Report.resolved_at < year_end,
        )
        .first()
    )
    return bool(resolved)


def _earned_badge_ids(db: Session, user: User) -> set[str]:
    """Compute which badge IDs *user* currently qualifies for based on their activity."""
    earned: set[str] = set()

    reported_count: int = (
        db.query(func.count(Report.id)).filter(Report.created_by_user_id == user.id).scalar()
    ) or 0
    for threshold, badge in REPORTING_BADGES:
        if reported_count >= threshold:
            earned.add(badge.id)

    resolved_count: int = (
        db.query(func.count(Report.id))
        .filter(Report.resolved_by_user_id == user.id, Report.status == ReportStatus.cleaned)
        .scalar()
    ) or 0
    for threshold, badge in RESOLVING_BADGES:
        if resolved_count >= threshold:
            earned.add(badge.id)

    full_years = _years_since_signup(user)
    created = user.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)

    for year_threshold, badge in LOYALTY_BADGES:
        if full_years < year_threshold:
            break
        year_start = created.replace(year=created.year + year_threshold - 1)
        year_end = created.replace(year=created.year + year_threshold)
        if _had_activity_in_year(db, user.id, year_start, year_end):
            earned.add(badge.id)

    return earned


def evaluate_badges(db: Session, user: User) -> list[BadgeRead]:
    """Persist any newly-earned badges for *user* and return their full badge list.

    Newly-inserted rows have ``acknowledged_at=None`` so the frontend can
    highlight them and prompt the user to view/share the achievement.
    """
    earned_ids = _earned_badge_ids(db, user)

    existing_rows = db.query(UserBadge).filter(UserBadge.user_id == user.id).all()
    existing_by_id = {row.badge_id: row for row in existing_rows}

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    missing_ids = [bid for bid in earned_ids if bid not in existing_by_id]
    # Legacy-user backfill: if this is the first time we persist any badges for
    # the user and they already qualify for more than one, they were active
    # before the persistence feature shipped. Mark those as already
    # acknowledged so the "new badge" banner doesn't spam them with old earns.
    legacy_backfill = not existing_rows and len(missing_ids) > 1

    new_rows: list[UserBadge] = []
    for badge_id in missing_ids:
        awarded_at = user.created_at if legacy_backfill else now
        acknowledged_at = now if legacy_backfill else None
        row = UserBadge(
            user_id=user.id,
            badge_id=badge_id,
            awarded_at=awarded_at,
            acknowledged_at=acknowledged_at,
        )
        db.add(row)
        new_rows.append(row)

    if new_rows:
        db.commit()
        for row in new_rows:
            existing_by_id[row.badge_id] = row

    # Return in a stable order: grouped by definition order (reporting → resolving → loyalty)
    result: list[BadgeRead] = []
    for badge_id, badge_def in _ALL_BADGES.items():
        row = existing_by_id.get(badge_id)
        if row is None:
            continue
        result.append(
            BadgeRead(
                id=badge_def.id,
                name=badge_def.name,
                description=badge_def.description,
                awarded_at=row.awarded_at,
                acknowledged_at=row.acknowledged_at,
            )
        )
    return result
