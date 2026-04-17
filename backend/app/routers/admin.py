"""Admin task endpoints — invoked by cron / scheduled jobs via shared secret."""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import ADMIN_TASK_SECRET
from app.database import get_db
from app.services.stale_reports import mark_stale_reports

router = APIRouter()


def _require_task_secret(x_task_secret: str | None = Header(default=None)) -> None:
    if not ADMIN_TASK_SECRET or x_task_secret != ADMIN_TASK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing task secret",
        )


@router.post("/tasks/mark-stale")
def trigger_mark_stale(
    db: Session = Depends(get_db),
    _auth: None = Depends(_require_task_secret),
):
    """Scan pending reports and append a `stale` log entry to those inactive for the configured window."""
    marked = mark_stale_reports(db)
    return {"marked": marked}
