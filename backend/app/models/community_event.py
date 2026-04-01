"""CommunityEvent model — planned cleanup events with a meeting point and linked reports."""

import uuid
from datetime import datetime

from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Table, Uuid

from app.database import Base
from sqlalchemy.orm import relationship

event_reports = Table(
    "event_reports",
    Base.metadata,
    Column(
        "event_id", Uuid, ForeignKey("community_events.id", ondelete="CASCADE"), primary_key=True
    ),
    Column("report_id", Uuid, ForeignKey("reports.id", ondelete="CASCADE"), primary_key=True),
)


class CommunityEvent(Base):
    __tablename__ = "community_events"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    community_id = Column(
        Uuid, ForeignKey("communities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    date = Column(DateTime, nullable=False)
    meeting_latitude = Column(Float, nullable=False)
    meeting_longitude = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    reports = relationship("Report", secondary=event_reports, lazy="joined")
