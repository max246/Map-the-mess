"""ReportStatusLog model — append-only audit log of report status transitions."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Uuid

from app.database import Base


class ReportStatusAction(str, enum.Enum):
    created = "created"
    cleaned = "cleaned"
    reopened = "reopened"
    stale = "stale"
    unstale = "unstale"


class ReportStatusLog(Base):
    __tablename__ = "report_status_log"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    report_id = Column(
        Uuid, ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True
    )
    action: Column[ReportStatusAction] = Column(Enum(ReportStatusAction), nullable=False)
    cycle = Column(Integer, nullable=False, default=0)
    performed_by_user_id = Column(Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
