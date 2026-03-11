"""CRUD routes for litter reports."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.report import Report, ReportStatus
from app.schemas.report import ReportCreate, ReportRead

router = APIRouter()


@router.get("/", response_model=List[ReportRead])
def list_reports(status: str | None = None, db: Session = Depends(get_db)):
    """List all reports, optionally filtered by status."""
    q = db.query(Report)
    if status:
        q = q.filter(Report.status == status)
    return q.order_by(Report.created_at.desc()).all()


@router.get("/{report_id}", response_model=ReportRead)
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(Report).get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.post("/", response_model=ReportRead, status_code=201)
def create_report(data: ReportCreate, db: Session = Depends(get_db)):
    """Create a new litter report."""
    report = Report(**data.model_dump())
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.patch("/{report_id}/clean", response_model=ReportRead)
def mark_cleaned(report_id: int, db: Session = Depends(get_db)):
    """Mark a report as cleaned."""
    report = db.query(Report).get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.status = ReportStatus.cleaned
    db.commit()
    db.refresh(report)
    return report
