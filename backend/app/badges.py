"""Badge definitions and evaluation logic."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Sequence

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.community_event import CommunityEvent
from app.models.community_post import CommunityPost
from app.models.report import Report, ReportStatus
from app.models.user import User


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


def _years_since_signup(user: User) -> int:
    """Return the number of full years since the user signed up."""
    now = datetime.now(timezone.utc)
    created = user.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    delta = now - created
    return delta.days // 365


def _had_activity_in_year(
    db: Session, user_id: int, year_start: datetime, year_end: datetime
) -> bool:
    """Check if the user reported, resolved, or created community content in a given year window."""
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
    if resolved:
        return True

    posted = (
        db.query(CommunityPost.id)
        .filter(CommunityPost.community_id.in_(db.query(func.distinct(CommunityPost.community_id))))
        .limit(0)  # placeholder — posts don't have user_id yet
    )
    # CommunityPost and CommunityEvent don't track the author yet, so for
    # now we only check reports.  When an author column is added, extend here.
    return False


def evaluate_badges(db: Session, user: User) -> list[dict[str, str]]:
    """Return the list of badges earned by *user*."""
    badges: list[dict[str, str]] = []

    # ── Reporting ────────────────────────────────────────────────────
    reported_count: int = (
        db.query(func.count(Report.id)).filter(Report.created_by_user_id == user.id).scalar()
    ) or 0

    for threshold, badge in REPORTING_BADGES:
        if reported_count >= threshold:
            badges.append({"id": badge.id, "name": badge.name, "description": badge.description})

    # ── Resolving ────────────────────────────────────────────────────
    resolved_count: int = (
        db.query(func.count(Report.id))
        .filter(Report.resolved_by_user_id == user.id, Report.status == ReportStatus.cleaned)
        .scalar()
    ) or 0

    for threshold, badge in RESOLVING_BADGES:
        if resolved_count >= threshold:
            badges.append({"id": badge.id, "name": badge.name, "description": badge.description})

    # ── Loyalty ──────────────────────────────────────────────────────
    full_years = _years_since_signup(user)
    created = user.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)

    for year_threshold, badge in LOYALTY_BADGES:
        if full_years < year_threshold:
            break
        # Check the user had activity during that anniversary year
        year_start = created.replace(year=created.year + year_threshold - 1)
        year_end = created.replace(year=created.year + year_threshold)
        if _had_activity_in_year(db, int(user.id), year_start, year_end):
            badges.append({"id": badge.id, "name": badge.name, "description": badge.description})

    return badges
