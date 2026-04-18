"""Badges routes — let users acknowledge badges they've earned so the
"new badge" banner can be dismissed individually."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.badges import _ALL_BADGES, evaluate_badges
from app.database import get_db
from app.models.user import User
from app.models.user_badge import UserBadge
from app.routers.auth import get_current_user
from app.schemas.user import BadgeRead

router = APIRouter()


@router.post("/{badge_id}/acknowledge", response_model=BadgeRead)
def acknowledge_badge(
    badge_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a badge as seen by the current user.

    Re-running evaluate_badges first ensures the row exists even if the user
    hits this endpoint before their next profile fetch.
    """
    if badge_id not in _ALL_BADGES:
        raise HTTPException(status_code=404, detail="Unknown badge")

    evaluate_badges(db, current_user)

    row = (
        db.query(UserBadge)
        .filter(UserBadge.user_id == current_user.id, UserBadge.badge_id == badge_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Badge not earned yet")

    if row.acknowledged_at is None:
        row.acknowledged_at = datetime.now(timezone.utc).replace(tzinfo=None)
        db.commit()
        db.refresh(row)

    badge_def = _ALL_BADGES[badge_id]
    return BadgeRead(
        id=badge_def.id,
        name=badge_def.name,
        description=badge_def.description,
        awarded_at=row.awarded_at,
        acknowledged_at=row.acknowledged_at,
    )
