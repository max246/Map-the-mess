"""EventAttendance model — tracks which users are attending community events."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, UniqueConstraint, Uuid

from app.database import Base


class EventAttendance(Base):
    __tablename__ = "event_attendances"
    __table_args__ = (UniqueConstraint("event_id", "user_id", name="uq_event_attendance"),)

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    event_id = Column(
        Uuid, ForeignKey("community_events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
