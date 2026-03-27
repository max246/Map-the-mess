"""CommunityEvent model — planned cleanup events with a meeting point and linked reports."""

from datetime import datetime

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Table

from app.database import Base
from sqlalchemy.orm import relationship

event_reports = Table(
    "event_reports",
    Base.metadata,
    Column(
        "event_id", Integer, ForeignKey("community_events.id", ondelete="CASCADE"), primary_key=True
    ),
    Column("report_id", Integer, ForeignKey("reports.id", ondelete="CASCADE"), primary_key=True),
)


class CommunityEvent(Base):
    __tablename__ = "community_events"

    id = Column(Integer, primary_key=True, index=True)
    community_id = Column(
        Integer, ForeignKey("communities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    description = Column(String, nullable=False)
    date = Column(DateTime, nullable=False)
    meeting_latitude = Column(Float, nullable=False)
    meeting_longitude = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    reports = relationship("Report", secondary=event_reports, lazy="joined")
