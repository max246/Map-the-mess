"""Report model — a single litter report from the public."""

from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime, Enum
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
    photo_url = Column(String, nullable=True)
    status = Column(Enum(ReportStatus), default=ReportStatus.pending)
    created_at = Column(DateTime, default=datetime.utcnow)
