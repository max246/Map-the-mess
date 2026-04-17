"""Detect open reports with no activity for a configurable window and mark them stale."""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.config import REPORT_STALE_DAYS
from app.models.report import Report, ReportStatus
from app.models.report_status_log import ReportStatusAction, ReportStatusLog


def mark_stale_reports(db: Session, threshold_days: int | None = None) -> int:
    """Append a `stale` log entry to pending reports inactive for `threshold_days`.

    Returns the number of reports newly marked stale. Idempotent — a report whose
    latest entry in the current cycle is already `stale` is skipped.
    """
    days = threshold_days if threshold_days is not None else REPORT_STALE_DAYS
    cutoff = datetime.utcnow() - timedelta(days=days)

    pending_reports = db.query(Report).filter(Report.status == ReportStatus.pending).all()
    marked = 0
    for report in pending_reports:
        cycle_entries = [e for e in report.status_log if e.cycle == report.current_cycle]
        if not cycle_entries:
            continue
        latest = cycle_entries[-1]
        if latest.action == ReportStatusAction.stale:
            continue
        if latest.created_at >= cutoff:
            continue
        db.add(
            ReportStatusLog(
                report_id=report.id,
                action=ReportStatusAction.stale,
                cycle=report.current_cycle,
                performed_by_user_id=None,
            )
        )
        marked += 1

    if marked:
        db.commit()
    return marked
