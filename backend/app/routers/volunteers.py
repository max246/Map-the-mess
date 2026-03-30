"""Volunteer routes — favourite/star reports for planned cleanups."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.favourite import Favourite
from app.models.report import Report, ReportStatus
from app.models.user import User, UserType
from app.routers.auth import get_current_user
from app.schemas.report import ReportRead
from app.schemas.user import LeaderboardEntry, PublicProfile

router = APIRouter()


def _abbreviate_name(full_name: str) -> str:
    """'Zoe Brum' → 'Zoe B.', 'Zoe' → 'Zoe'."""
    parts = full_name.split()
    if len(parts) <= 1:
        return full_name
    return f"{parts[0]} {parts[-1][0]}."


@router.get("/count")
def volunteer_count(db: Session = Depends(get_db)):
    """Return the total number of registered volunteers."""
    count = db.query(User).count()
    return {"count": count}


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
def leaderboard(
    months: int = Query(1, ge=1, le=12, description="Number of months to look back"),
    limit: int = Query(15, ge=1, le=50, description="Number of top volunteers to return"),
    db: Session = Depends(get_db),
):
    """Return the top volunteers ranked by number of reports cleaned within the given period."""
    now = datetime.now(timezone.utc)
    # Go back to the 1st of the month N months ago
    month = now.month - months
    year = now.year
    while month < 1:
        month += 12
        year -= 1
    since = datetime(year, month, 1, tzinfo=timezone.utc)

    rows = (
        db.query(
            User.id,
            User.full_name,
            func.count(Report.id).label("cleaned_count"),
        )
        .join(Report, Report.resolved_by_user_id == User.id)
        .filter(
            Report.status == ReportStatus.cleaned,
            Report.resolved_at >= since,
            User.user_type != UserType.superuser,
        )
        .group_by(User.id, User.full_name)
        .order_by(func.count(Report.id).desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "user_id": row.id,
            "rank": i + 1,
            "name": _abbreviate_name(row.full_name),
            "cleaned_count": row.cleaned_count,
        }
        for i, row in enumerate(rows)
    ]


@router.get("/{user_id}/profile", response_model=PublicProfile)
def public_profile(user_id: int, db: Session = Depends(get_db)):
    """Return a volunteer's public profile."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.user_type == UserType.superuser:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    return {
        "name": _abbreviate_name(str(user.full_name)),
        "avatar_url": user.avatar_url,
        "badges": [],
        "member_since": user.created_at,
    }


@router.get("/favourites", response_model=list[ReportRead])
def list_favourites(
    status: Optional[str] = Query(None, description="Filter by report status: pending or cleaned"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List the current user's favourite reports, optionally filtered by status."""
    q = (
        db.query(Report)
        .join(Favourite, Favourite.report_id == Report.id)
        .filter(Favourite.user_id == current_user.id)
    )
    if status:
        q = q.filter(Report.status == status)
    return q.order_by(Report.created_at.desc()).all()


@router.post("/favourites/{report_id}", status_code=201)
def add_favourite(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Star a report to add it to the user's planned cleanups."""
    report = db.query(Report).get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    existing = (
        db.query(Favourite)
        .filter(Favourite.user_id == current_user.id, Favourite.report_id == report_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Report already favourited")

    db.add(Favourite(user_id=current_user.id, report_id=report_id))
    db.commit()
    return {"detail": "Report added to favourites"}


@router.delete("/favourites/{report_id}", status_code=204)
def remove_favourite(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a report from the user's planned cleanups."""
    fav = (
        db.query(Favourite)
        .filter(Favourite.user_id == current_user.id, Favourite.report_id == report_id)
        .first()
    )
    if not fav:
        raise HTTPException(status_code=404, detail="Favourite not found")
    db.delete(fav)
    db.commit()
