"""ReportImage model — images attached to a litter report."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Uuid

from app.database import Base


class ImageType(str, enum.Enum):
    report = "report"
    resolved = "resolved"


class ReportImage(Base):
    __tablename__ = "report_images"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    report_id = Column(
        Uuid, ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True
    )
    url = Column(String, nullable=False)
    thumbnail_url = Column(String, nullable=True)
    image_type: Column[ImageType] = Column(Enum(ImageType), nullable=False)
    cycle = Column(Integer, default=0, nullable=False, server_default="0")
    created_at = Column(DateTime, default=datetime.utcnow)
