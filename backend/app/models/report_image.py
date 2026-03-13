"""ReportImage model — images attached to a litter report."""

import enum
from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey

from app.database import Base


class ImageType(str, enum.Enum):
    report = "report"
    resolved = "resolved"


class ReportImage(Base):
    __tablename__ = "report_images"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(String, nullable=False)
    image_type = Column(Enum(ImageType), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
