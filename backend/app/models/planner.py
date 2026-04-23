"""Planner models — optimised walking routes through selected reports."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import relationship

from app.database import Base


class PlanStatus(str, enum.Enum):
    planned = "planned"
    in_progress = "in_progress"
    completed = "completed"


class Plan(Base):
    __tablename__ = "plans"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=True)
    start_latitude = Column(Float, nullable=False)
    start_longitude = Column(Float, nullable=False)
    status: Column[PlanStatus] = Column(
        Enum(PlanStatus), default=PlanStatus.planned, nullable=False
    )
    total_distance_meters = Column(Float, nullable=True)
    total_duration_seconds = Column(Float, nullable=True)
    route_geometry = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="plans", lazy="joined")
    plan_reports = relationship(
        "PlanReport",
        backref="plan",
        cascade="all, delete-orphan",
        lazy="joined",
        order_by="PlanReport.visit_order",
    )
    plan_bins = relationship(
        "PlanBin",
        backref="plan",
        cascade="all, delete-orphan",
        lazy="joined",
        order_by="PlanBin.visit_order",
    )

    @property
    def report_count(self) -> int:
        return len(self.plan_reports)


class PlanReport(Base):
    __tablename__ = "plan_reports"
    __table_args__ = (UniqueConstraint("plan_id", "report_id", name="uq_plan_report"),)

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    plan_id = Column(Uuid, ForeignKey("plans.id", ondelete="CASCADE"), nullable=False, index=True)
    report_id = Column(
        Uuid, ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True
    )
    visit_order = Column(Integer, nullable=False)
    leg_distance_meters = Column(Float, nullable=True)
    leg_duration_seconds = Column(Float, nullable=True)

    report = relationship("Report", lazy="joined")


class PlanBin(Base):
    __tablename__ = "plan_bins"
    __table_args__ = (UniqueConstraint("plan_id", "bin_id", name="uq_plan_bin"),)

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    plan_id = Column(Uuid, ForeignKey("plans.id", ondelete="CASCADE"), nullable=False, index=True)
    bin_id = Column(Uuid, ForeignKey("bins.id", ondelete="CASCADE"), nullable=False, index=True)
    visit_order = Column(Integer, nullable=False)
    leg_distance_meters = Column(Float, nullable=True)
    leg_duration_seconds = Column(Float, nullable=True)

    bin = relationship("Bin", lazy="joined")
