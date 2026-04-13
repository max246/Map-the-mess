"""Report model — a single litter report from the public."""

import uuid
from datetime import datetime
from sqlalchemy import Column, Float, Integer, String, DateTime, Enum, ForeignKey, Uuid
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class ReportType(str, enum.Enum):
    litter = "litter"
    gas_canister = "gas_canister"


class ReportStatus(str, enum.Enum):
    pending = "pending"
    cleaned = "cleaned"


class Report(Base):
    __tablename__ = "reports"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    report_type: Column[ReportType] = Column(
        Enum(ReportType), nullable=False, default=ReportType.litter
    )
    description = Column(String, default="")
    what3words = Column(String, nullable=True)
    address = Column(String, nullable=True)
    created_by_user_id = Column(Uuid, ForeignKey("users.id"), nullable=True)
    resolved_by_user_id = Column(Uuid, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    status: Column[ReportStatus] = Column(Enum(ReportStatus), default=ReportStatus.pending)
    current_cycle = Column(Integer, default=0, nullable=False, server_default="0")
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
    status_log = relationship(
        "ReportStatusLog",
        backref="report",
        cascade="all, delete-orphan",
        lazy="joined",
        order_by="ReportStatusLog.created_at",
    )
    comments = relationship(
        "ReportComment",
        back_populates="report",
        cascade="all, delete-orphan",
        lazy="joined",
        order_by="ReportComment.created_at",
    )
