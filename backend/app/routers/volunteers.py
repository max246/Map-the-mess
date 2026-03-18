"""Volunteer routes — favourite/star reports for planned cleanups."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.favourite import Favourite
from app.models.report import Report, ReportStatus
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.report import ReportRead

router = APIRouter()


@router.get("/count")
def volunteer_count(db: Session = Depends(get_db)):
    """Return the total number of registered volunteers."""
    count = db.query(User).count()
    return {"count": count}


@router.get("/favourites", response_model=list[ReportRead])
def list_favourites(
    status: Optional[str] = Query(None, description="Filter by report status: pending or cleaned"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List the current user's favourite reports, optionally filtered by status."""
    q = db.query(Report).join(Favourite, Favourite.report_id == Report.id).filter(
        Favourite.user_id == current_user.id
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
