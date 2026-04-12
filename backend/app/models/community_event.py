"""CommunityEvent model — planned cleanup events with a meeting point and linked reports."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    String,
    Float,
    DateTime,
    ForeignKey,
    Table,
    Uuid,
    Boolean,
    UniqueConstraint,
)

from app.database import Base
from sqlalchemy.orm import relationship, backref

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
    __table_args__ = (UniqueConstraint("parent_event_id", "date", name="uq_event_occurrence"),)

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

    # Recurrence fields
    recurrence_rule = Column(String, nullable=True)  # "weekly" | "biweekly" | "monthly"
    recurrence_end = Column(DateTime, nullable=True)
    parent_event_id = Column(
        Uuid, ForeignKey("community_events.id", ondelete="CASCADE"), nullable=True, index=True
    )
    is_cancelled = Column(Boolean, default=False, nullable=False)

    reports = relationship("Report", secondary=event_reports, lazy="joined")
    exceptions = relationship(
        "CommunityEvent",
        backref=backref("parent_event", remote_side="CommunityEvent.id"),
        lazy="selectin",
    )
