"""Report model — a single litter report from the public."""

from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class ReportStatus(str, enum.Enum):
    pending = "pending"
    cleaned = "cleaned"


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    description = Column(String, default="")
    what3words = Column(String, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    status: Column[ReportStatus] = Column(Enum(ReportStatus), default=ReportStatus.pending)
    created_at = Column(DateTime, default=datetime.utcnow)

    created_by = relationship(
        "User", foreign_keys=[created_by_user_id], backref="created_reports", lazy="joined"
    )
    resolved_by = relationship(
        "User", foreign_keys=[resolved_by_user_id], backref="resolved_reports", lazy="joined"
    )
    images = relationship(
        "ReportImage", backref="report", cascade="all, delete-orphan", lazy="joined"
    )
